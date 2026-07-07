/* eslint-disable @typescript-eslint/naming-convention */

import Enquirer, { type EventEmitter } from 'enquirer';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { stripVTControlCharacters as strip, styleText } from 'node:util';
import packageJson from 'package-json';
import semverDiff from 'semver/functions/diff';
import semverMajor from 'semver/functions/major';

import { latestVersion, type LatestVersionPackage, type Package, type PackageJson } from './index';

/** Used to fix Enquirer missing types */
declare module 'enquirer' {
    /* eslint-disable @typescript-eslint/method-signature-style */
    interface Prompt<T = string> extends EventEmitter {
        state: {
            size: number;
            submitted: boolean;
            cancelled: boolean;
        };
        value: T;
        stdout: NodeJS.WriteStream;
        cancel(err?: unknown): void;
        clear(lines?: number): void;
        render(): void;
        run(): Promise<T>;
        submit(value?: unknown): Promise<void>;
        up(): void;
        down(): void;
        left(): void;
        right(): void;
        space(): void;
    }
    /* eslint-enable @typescript-eslint/method-signature-style */
}

type Color = Parameters<typeof styleText>[0];

interface RenderLine {
    rowIndex: number;
    line: string;
    groupColor: Color;
    groupTitle?: string;
    groupTitleRaw?: string;
    groupDesc?: string;
}

type TablePromptOptions = Omit<ConstructorParameters<typeof Enquirer.Prompt>[0], 'name' | 'type' | 'message'> & {
    interactive: boolean;
    rows: TableRow[];
    columns: TableColumn[];
};

interface TableSelectedItem {
    pkgName: string;
    version: string;
}

type TableRowGroupId = 'patch' | 'minor' | 'major' | 'majorVersionZero' | 'missing' | 'invalid' | 'unavailable';

interface TableRowGroup {
    id: TableRowGroupId;
    color: Color;
    title: string;
    desc: string;
};

interface TableRow {
    groupId: TableRowGroupId;
    separator: string;
    pkgName: string;
    tagOrRange: string;
    installed: string;
    wanted: string;
    isWantedSelectable: boolean;
    latest: string;
    isLatestSelectable: boolean;
    url: string;
}

type TableColumnId = Exclude<keyof TableRow, 'groupId' | 'isWantedSelectable' | 'isLatestSelectable'>;

interface TableColumn {
    id: TableColumnId;
    label: string;
    align: 'left' | 'center' | 'right';
    maxLength: number;
    isSelectable: boolean;
}

const CHEVRON = '❯ ';
const CHECKBOX_ON = ' ◉ ';
const CHECKBOX_OFF = ' ◯ ';

const colorizeDiff = (from: string, to: string): string => {
    const toParts = to.split('.');

    const diffIndex = from.split('.').findIndex((part, i) => part !== toParts[i]);
    if (diffIndex !== -1) {
        let color: Color = 'magenta';
        if (toParts[0] !== '0') {
            switch (diffIndex) {
                case 0: color = 'red'; break;
                case 1: color = 'cyan'; break;
                default: color = 'green';
            }
        }
        const start = toParts.slice(0, diffIndex).join('.');
        const mid = (diffIndex === 0) ? '' : '.';
        const end = styleText(color, toParts.slice(diffIndex).join('.'));
        return `${start}${mid}${end}`;
    }

    return styleText('gray', to);
};

const getPackageHomePage = async (name: string): Promise<string> => {
    try {
        const pkgData = await packageJson(name, { fullMetadata: true, allVersions: true });
        const pkgDataLatest = pkgData.versions[pkgData['dist-tags'].latest] as { homepage?: string; bugs?: { url: string }; repository?: { url: string } };
        const homepage = pkgDataLatest.homepage ?? pkgDataLatest.bugs?.url ?? pkgDataLatest.repository?.url;
        return (homepage) ? `\u001b]8;;${homepage}\u001b\\${new URL(homepage).hostname}\u001b]8;;\u001b\\ 🔗` : '-';
    } catch {
        return '-';
    }
};

const cellRenderer = (row: TableRow, column: TableColumn, isFocused = false, isSelectable = false, isSelected = false): string => {
    let content = row[column.id];

    if (!isFocused) {
        switch (column.id) {
            case 'installed':
            case 'tagOrRange':
                content = styleText('gray', content);
                break;
            case 'separator':
            case 'url':
                content = styleText('blue', content);
                break;
            case 'pkgName':
                content = styleText('yellow', content);
                break;
            case 'wanted':
                if (row.installed === 'missing') {
                    content = styleText('blue', row.wanted);
                } else if (!row.isWantedSelectable) {
                    content = styleText('gray', row.wanted);
                } else {
                    content = colorizeDiff(row.installed, row.wanted);
                }
                break;
            case 'latest':
                if (!row.isLatestSelectable && row.latest === row.wanted) {
                    content = styleText('gray', row.latest);
                } else if (!row.isLatestSelectable && row.latest === row.installed) {
                    content = styleText('gray', row.latest);
                } else {
                    content = colorizeDiff(row.installed, row.latest);
                }
                break;
            default: break;
        }
    }

    let contentLength = strip(content).length;
    if (column.id === 'pkgName') {
        contentLength += CHEVRON.length;
    }
    if (column.isSelectable) {
        const checkboxIcon = isSelected ? styleText('green', CHECKBOX_ON) : styleText('gray', CHECKBOX_OFF);
        const checkbox = (isSelectable) ? checkboxIcon : '';
        const gap = ' '.repeat(Math.max(0, column.maxLength - contentLength - strip(checkbox).length));
        content = checkbox + gap + content;
    } else {
        const gap = ' '.repeat(Math.max(0, column.maxLength - contentLength));
        content = (column.align === 'right') ? gap + content : content + gap;
    }

    return (isFocused) ? styleText('inverse', content) : content;
};

const columnHeaderRenderer = (column: TableColumn): string => {
    const text = column.label;
    const gap = ' '.repeat(Math.max(0, column.maxLength - strip(text).length));
    const label = styleText('underline', text);
    return (column.align === 'right') ? `${gap}${label}` : `${label}${gap}`;
};

const drawBox = (lines: string[], color: Color = 'cyan', horizontalPadding = 3): string => {
    const results: string[] = [];
    const maxLineWidth = lines.reduce((max, row) => Math.max(max, strip(row).length), 0);

    results.push(styleText(color, `┌${'─'.repeat(maxLineWidth + (horizontalPadding * 2))}┐`));
    lines.forEach(row => {
        const padding = ' '.repeat(horizontalPadding);
        const fullRow = `${row}${' '.repeat(maxLineWidth - strip(row).length)}`;
        results.push(`${styleText(color, '│')}${padding}${fullRow}${padding}${styleText(color, '│')}`);
    });
    results.push(styleText(color, `└${'─'.repeat(maxLineWidth + (horizontalPadding * 2))}┘`));
    return results.join('\n');
};

class TablePrompt extends Enquirer.Prompt<TableSelectedItem[] | undefined> {
    private COLUMN_GAP = 3;

    private interactive = false;
    private rows: TableRow[];
    private columns: TableColumn[];

    private currentRowIndex = 0;
    private currentColumnIndex = 0; // 0 = Wanted, 1 = Latest
    private selectableRowIndexes: number[] = [];

    private selectedUpdates = new Map<string, 'wanted' | 'latest'>();

    public constructor(options: TablePromptOptions) {
        // @ts-expect-error Not assignable to parameter of type 'PromptOptions | undefined'
        super(options);

        this.interactive = options.interactive;
        this.rows = options.rows;
        this.columns = options.columns;

        this.rows.forEach((row, index) => {
            if (!this.interactive || row.isWantedSelectable || row.isLatestSelectable) {
                this.selectableRowIndexes.push(index);
            }
        });

        if (this.selectableRowIndexes.length) {
            this.currentRowIndex = this.selectableRowIndexes[0];
            if (this.interactive) {
                this.ensureValidCurrentColumnIndex();
            }
        }

        this.stdout.write('\u001b[?25l'); // Hide cursor
    }

    public override render = (): void => {
        if (this.state.submitted || this.state.cancelled) {
            this.clear();
            return;
        }

        const renderLines = this.getRenderLines();

        // Pagination logic
        const terminalHeight = process.stdout.rows - 2 || 24;
        const fixedLines = (this.interactive ? 7 : 6) + 1 + 1 + 2; // Message + Instructions + Header + Last empty + Box borders

        const { start, end } = this.getPagination(renderLines, terminalHeight, fixedLines);
        const lines = this.assembleLines(renderLines, start, end);

        const output = drawBox(lines.filter((l): l is string => l !== undefined));
        this.clear();
        this.stdout.write(output);
        this.state.size = output.split('\n').length - 1;
    };

    public override clear(): void {
        if (this.state.size > 0) {
            this.stdout.write(`\u001b[${this.state.size}A\r\u001b[J`);
            this.state.size = 0;
        }
    }

    public override cancel(): void {
        super.cancel();
        process.exit(0);
    }

    public override up(): void {
        const currentIndex = this.selectableRowIndexes.indexOf(this.currentRowIndex);
        if (currentIndex > 0) {
            this.currentRowIndex = this.selectableRowIndexes[currentIndex - 1];
            if (this.interactive) {
                this.ensureValidCurrentColumnIndex();
            }
        }
        this.render();
    }

    public override down(): void {
        const currentIndex = this.selectableRowIndexes.indexOf(this.currentRowIndex);
        if (currentIndex < this.selectableRowIndexes.length - 1) {
            this.currentRowIndex = this.selectableRowIndexes[currentIndex + 1];
            if (this.interactive) {
                this.ensureValidCurrentColumnIndex();
            }
        }
        this.render();
    }

    public override left(): void {
        if (this.interactive) {
            const row = this.rows[this.currentRowIndex];
            if (row.isWantedSelectable) {
                this.currentColumnIndex = 0;
                this.render();
            }
        }
    }

    public override right(): void {
        if (this.interactive) {
            const row = this.rows[this.currentRowIndex];
            if (row.isLatestSelectable) {
                this.currentColumnIndex = 1;
                this.render();
            }
        }
    }

    public override space(): void {
        if (this.interactive) {
            const row = this.rows[this.currentRowIndex];
            const selectedType = (this.currentColumnIndex === 0) ? 'wanted' : 'latest';
            const isSelectable = (selectedType === 'wanted') ? row.isWantedSelectable : row.isLatestSelectable;

            if (isSelectable) {
                const currentType = this.selectedUpdates.get(row.pkgName);
                if (currentType === selectedType) {
                    this.selectedUpdates.delete(row.pkgName);
                } else {
                    this.selectedUpdates.set(row.pkgName, selectedType);
                }
                this.render();
            }
        }
    }

    public override async submit(): Promise<void> {
        this.state.submitted = true;
        this.render();
        this.stdout.write('\u001b[?25h'); // Show cursor
        this.value = Array.from(this.selectedUpdates.entries())
            .reduce<TableSelectedItem[]>((items, [pkgName, type]) => {
                const row = this.rows.find(r => r.pkgName === pkgName);
                if (row) {
                    items.push({ pkgName, version: row[type] });
                }
                return items;
            }, []);
        return super.submit();
    }

    // --- HELPER(s) ---

    private getRenderLines(): RenderLine[] {
        const groups = getTableRowGroups();
        return this.rows.reduce<RenderLine[]>((items, row) => {
            const rowIndex = this.rows.indexOf(row);
            const group = groups.find(g => g.id === row.groupId);
            if (!group) { return items; }

            const isFirstInGroup = items.length === 0 || items[items.length - 1].groupTitleRaw !== group.title;
            const groupTitle = isFirstInGroup ? styleText(group.color, `${styleText('bold', group.title)} ${styleText('italic', `(${group.desc})`)}`) : undefined;

            const isFocusedRow = (this.currentRowIndex === rowIndex);
            const chevron = isFocusedRow ? styleText('white', CHEVRON) : ' '.repeat(CHEVRON.length);

            const line = this.columns.map(column => {
                const isSelectable = this.interactive && ((column.id === 'wanted' && row.isWantedSelectable) || (column.id === 'latest' && row.isLatestSelectable));
                const isSelected = (this.selectedUpdates.get(row.pkgName) === column.id);
                const isFocused = this.interactive && isFocusedRow && isSelectable && column.isSelectable && ((column.id === 'wanted' ? this.currentColumnIndex === 0 : this.currentColumnIndex === 1));
                return cellRenderer(row, column, isFocused, isSelectable, isSelected);
            }).join(' '.repeat(this.COLUMN_GAP));

            items.push({
                rowIndex,
                line: chevron + line,
                groupTitle,
                groupColor: group.color,
                groupDesc: group.desc,
                groupTitleRaw: group.title,
            });

            return items;
        }, []);
    }

    private getPagination(renderLines: RenderLine[], terminalHeight: number, fixedLines: number): { start: number; end: number } {
        const getRequiredHeight = (s: number, e: number): number => {
            const initialCount = fixedLines + (s > 0 ? 1 : 0) + (e < renderLines.length ? 2 : 0);
            return renderLines.slice(s, e).reduce((accumulator, item, index) => {
                const absoluteIndex = index + s;
                const hasBonus = (absoluteIndex === s && !item.groupTitle) || item.groupTitle;
                const itemHeight = (hasBonus ? 2 : 0) + 1;
                return accumulator + itemHeight;
            }, initialCount);
        };

        let start = 0;
        let end = renderLines.length;
        const cursorIndex = Math.max(0, renderLines.findIndex(l => l.rowIndex === this.currentRowIndex));

        if (getRequiredHeight(0, renderLines.length) > terminalHeight - 1) {
            start = cursorIndex;
            end = cursorIndex + 1;

            const maxIterations = terminalHeight;
            for (let i = 0; i < maxIterations; i++) {
                let expanded = false;
                if (start > 0 && getRequiredHeight(start - 1, end) <= terminalHeight - 1) {
                    start--;
                    expanded = true;
                }
                if (end < renderLines.length && getRequiredHeight(start, end + 1) <= terminalHeight - 1) {
                    end++;
                    expanded = true;
                }
                if (!expanded) { break; }
            }
        }

        return { start, end };
    }

    private assembleLines(renderLines: RenderLine[], start: number, end: number): (string | undefined)[] {
        const lines: (string | undefined)[] = [
            '',
            styleText('white', '🔥 Important updates are available.'),
            '',
        ];

        if (this.interactive) {
            lines.push(
                styleText('gray', '↑/↓: Select a version'),
                styleText('gray', 'Space: Toggle selection'),
                styleText('gray', 'Enter: Upgrade'),
                '',
            );
        } else {
            lines.push(
                styleText('gray', '↑/↓: Scroll'),
                styleText('gray', 'Enter: Quit'),
                '',
            );
        }

        lines.push(this.columns.map(columnHeaderRenderer).join(' '.repeat(this.COLUMN_GAP)));

        if (start > 0) {
            lines.push(styleText(['gray', 'italic'], `... ${start} more items above ...`));
        }

        for (let i = start; i < end; i++) {
            const item = renderLines[i];
            if (i === start && !item.groupTitle) {
                lines.push('');
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                lines.push(styleText(item.groupColor, `${styleText('bold', item.groupTitleRaw!)} ${styleText('italic', `(${item.groupDesc!})`)}`));
            } else if (item.groupTitle) {
                lines.push('');
                lines.push(item.groupTitle);
            }
            lines.push(item.line);
        }

        if (end < renderLines.length) {
            lines.push('');
            lines.push(styleText(['gray', 'italic'], `... ${renderLines.length - end} more items below ...`));
        }

        lines.push('');
        return lines;
    }

    private ensureValidCurrentColumnIndex(): void {
        const row = this.rows[this.currentRowIndex];
        if (this.currentColumnIndex === 0 && !row.isWantedSelectable) {
            this.currentColumnIndex = 1;
        } else if (this.currentColumnIndex === 1 && !row.isLatestSelectable) {
            this.currentColumnIndex = 0;
        }
    }
}

const getTableColumns = (rows: TableRow[], interactive = false): TableColumn[] => {
    const columns: TableColumn[] = [
        { id: 'pkgName', label: 'Package', align: 'left', maxLength: 0, isSelectable: false },
        { id: 'tagOrRange', label: 'Range', align: 'right', maxLength: 0, isSelectable: false },
        { id: 'separator', label: '', align: 'center', maxLength: 0, isSelectable: false },
        { id: 'installed', label: 'Installed', align: 'right', maxLength: 0, isSelectable: false },
        { id: 'wanted', label: 'Wanted', align: 'right', maxLength: 0, isSelectable: true },
        { id: 'latest', label: 'Latest', align: 'right', maxLength: 0, isSelectable: true },
        { id: 'url', label: 'Homepage', align: 'left', maxLength: 0, isSelectable: false },
    ];
    rows.forEach(row => {
        columns.forEach(column => {
            let rowValueLength = strip(row[column.id]).length;
            if (interactive && column.isSelectable) {
                rowValueLength += CHECKBOX_ON.length;
            }
            if (column.id === 'pkgName') {
                rowValueLength += CHEVRON.length;
            }

            column.maxLength = Math.max(column.maxLength, rowValueLength, column.label.length);
        });
    });
    return columns;
};

const getTableRowGroupId = (currentVersion?: string, newVersion?: string): TableRowGroupId => {
    if (currentVersion && newVersion) {
        if (semverMajor(newVersion) === 0) {
            return 'majorVersionZero';
        } else {
            const releaseType = semverDiff(currentVersion, newVersion) ?? '';
            if (['major', 'premajor', 'prerelease'].includes(releaseType)) {
                return 'major';
            } else if (['minor', 'preminor'].includes(releaseType)) {
                return 'minor';
            } else if (['patch', 'prepatch'].includes(releaseType)) {
                return 'patch';
            }
        }
    }
    return 'missing';
};

const getTableRowGroups = (): TableRowGroup[] => [
    { id: 'patch', color: 'green', title: 'Patch', desc: 'backwards-compatible bug fixes' },
    { id: 'minor', color: 'cyan', title: 'Minor', desc: 'backwards-compatible features' },
    { id: 'major', color: 'red', title: 'Major', desc: 'potentially breaking API changes' },
    { id: 'majorVersionZero', color: 'magenta', title: 'Major version zero', desc: 'not stable, anything may change' },
    { id: 'missing', color: 'blue', title: 'Missing', desc: 'not installed' },
    { id: 'invalid', color: 'gray', title: 'Invalid', desc: 'wrong range' },
    { id: 'unavailable', color: 'gray', title: 'Not found', desc: 'registry error' },
];

const getTableRows = async (latestVersionPackages: LatestVersionPackage[]): Promise<TableRow[]> => {
    const rowsPromises = latestVersionPackages.map(async pkg => {
        const updates = (typeof pkg.updatesAvailable === 'object') ? pkg.updatesAvailable : null;
        const isOutdated = (pkg.local && (pkg.local !== pkg.latest)) ?? (pkg.globalNpm && (pkg.globalNpm !== pkg.latest)) ?? (pkg.globalYarn && (pkg.globalYarn !== pkg.latest));
        const isNotInstalled = (!pkg.local && !pkg.globalNpm && !pkg.globalYarn);

        if (updates?.local || updates?.globalNpm || updates?.globalYarn || isOutdated || isNotInstalled) {
            let groupId: TableRowGroupId;
            if (pkg.error) {
                groupId = 'unavailable';
            } else if (!pkg.wanted) {
                groupId = 'invalid';
            } else {
                let newVersion = pkg.latest;
                if (typeof updates?.local === 'string') {
                    newVersion = updates.local;
                } else if (typeof updates?.globalNpm === 'string') {
                    newVersion = updates.globalNpm;
                } else if (typeof updates?.globalYarn === 'string') {
                    newVersion = updates.globalYarn;
                }
                groupId = getTableRowGroupId(pkg.local ?? pkg.globalNpm ?? pkg.globalYarn, newVersion);
            }

            const item = {
                groupId,
                pkgName: pkg.name,
                tagOrRange: pkg.wantedTagOrRange ?? 'unknown',
                separator: '→',
                installed: pkg.local ?? pkg.globalNpm ?? pkg.globalYarn ?? 'missing',
                wanted: pkg.wanted ?? 'unknown',
                latest: pkg.latest ?? 'unknown',
                url: await getPackageHomePage(pkg.name),
            } as TableRow;

            const isRowSelectable = !['missing', 'invalid', 'unavailable'].includes(groupId);
            item.isWantedSelectable = isRowSelectable && (item.wanted !== item.installed);
            item.isLatestSelectable = isRowSelectable && ((item.latest !== item.installed) && (item.latest !== item.wanted));

            return item;
        }

        return null;
    });

    const rows = (await Promise.all(rowsPromises)).filter((item): item is TableRow => item !== null);

    // Sort rows by their group
    const groupOrder = getTableRowGroups().map(group => group.id);
    return rows.sort((a, b) => {
        if (a.groupId !== b.groupId) {
            return groupOrder.indexOf(a.groupId) - groupOrder.indexOf(b.groupId);
        }
        return a.pkgName.localeCompare(b.pkgName);
    });
};

const checkUpdates = async (packages: Package[] | PackageJson, interactive: boolean): Promise<TableSelectedItem[]> => {
    const ora = (await import('ora')).default;
    const spinner = ora({ text: styleText('cyan', 'Checking versions...') });
    spinner.start();

    // Get latest versions of packages
    const latestVersionPackages = await latestVersion(packages, { useCache: true });

    // Get each updates as table rows
    const rows = await getTableRows(latestVersionPackages);

    spinner.stop();
    if (!rows.length) {
        console.log(styleText('green', '🎉 Packages are up-to-date'));
        return [];
    }

    // Get the table columns
    const columns = getTableColumns(rows, interactive);

    // Display all the updates as a table
    const prompt = new TablePrompt({ rows, columns, interactive });
    return await prompt.run() ?? [];
};

const getNpmGlobalPackages = (): Package[] => {
    try {
        const output = execSync('npm list -g --depth=0 --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const data = (JSON.parse(output) as PackageJson).dependencies as Record<string, { version: string }>;
        return Object.entries(data).map(([name, value]) => `${name}@${value.version}`);
    } catch {
        return [];
    }
};

const getLocalPackageJson = (path: string | undefined): PackageJson => {
    // Set working directory path
    if (path) {
        if (existsSync(path)) {
            process.chdir(statSync(path).isDirectory() ? path : dirname(path));
        } else {
            console.warn(styleText('red', `Error: path ${styleText('bold', path)} not found.`));
            return process.exit(-1);
        }
    }

    // Get package.json
    if (existsSync('package.json')) {
        console.log(styleText('gray', resolve('package.json')));
        return JSON.parse(readFileSync('package.json').toString()) as PackageJson;
    }

    console.warn(styleText('yellow', `No ${styleText('bold', 'package.json')} file were found.`));
    return process.exit(-1);
};

void (async (): Promise<void> => {
    const hasFlag = (long: string, short: string): boolean => args.includes(long) || args.some(a => /^-[^-]/.test(a) && a.includes(short));

    let args = process.argv.slice(2);
    const global = hasFlag('--global', 'g');
    const interactive = hasFlag('--interactive', 'i') || hasFlag('--update', 'u');
    args = args.filter(arg => !arg.startsWith('-'));

    const packages = (global) ? getNpmGlobalPackages() : getLocalPackageJson(args[0]);
    const selectedUpdates = await checkUpdates(packages, interactive);

    // Run the updates installation if needed
    if (interactive && selectedUpdates.length) {
        console.log(selectedUpdates);
        // console.log('Installing updates...');
        // const installArgs = selectedUpdates.map((s: { pkgName: string; version: string }) => `${s.pkgName}@${s.version}`);
        // const npm = spawn('npm', ['install', ...installArgs], { stdio: 'inherit', shell: true });
        // npm.on('close', (code) => {
        //     if (code === 0) {
        //         console.log(styleText('green', '\n✔ Updates installed successfully!'));
        //     } else {
        //         console.log(styleText('red', `\n✖ npm install failed with code ${code}`));
        //     }
        // });
    } else {
        console.log(styleText('yellow', 'No updates selected.'));
    }
})();
