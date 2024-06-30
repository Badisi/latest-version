import { blue, bold, cyan, gray, green, italic, magenta, red, reset, strip, underline, yellow } from '@colors/colors/safe';
import { existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import latestVersion, { type Package, type PackageJson, type LatestVersionPackage, LatestVersionOptions } from './index';
import semverMajor from 'semver/functions/major';
import semverDiff from 'semver/functions/diff';

interface TableColumn {
    label: string;
    attrName: keyof TableRow;
    align: 'left' | 'center' | 'right';
    maxLength: number;
    items: string[];
}

type TableRowGroup = 'patch' | 'minor' | 'major' | 'majorVersionZero' | 'unknown';

interface TableRow {
    name: string;
    location: string;
    installed: string;
    tagOrRange: string;
    separator: string;
    wanted: string;
    latest: string;
    group: TableRowGroup;
}

const colorizeDiff = (from: string, to: string): string => {
    const toParts = to.split('.');

    const diffIndex = from.split('.').findIndex((part, i) => part !== toParts[i]);
    if (diffIndex !== -1) {
        let color = magenta;
        if (toParts[0] !== '0') {
            color = (diffIndex === 0) ? red : ((diffIndex === 1) ? cyan : green);
        }
        const start = toParts.slice(0, diffIndex).join('.');
        const mid = (diffIndex === 0) ? '' : '.';
        const end = color(toParts.slice(diffIndex).join('.'));
        return `${start}${mid}${end}`;
    }
    return to;
};

const columnCellRenderer = (column: TableColumn, row: TableRow): string => {
    let text = row[column.attrName] ?? '';
    const gap = (text.length < column.maxLength) ? ' '.repeat(column.maxLength - text.length) : '';

    switch (column.attrName) {
        case 'name': text = yellow(text); break;
        case 'installed': case 'separator': text = blue(text); break;
        case 'location': case 'tagOrRange': text = gray(text); break;
        case 'wanted': text = colorizeDiff(row.installed, text); break;
        case 'latest':
            if (text !== row.wanted) {
                text = colorizeDiff(row.installed, text);
            }
            break;
        default: break;
    }

    return (column.align === 'right') ? `${gap}${text}` : `${text}${gap}`;
};

const columnHeaderRenderer = (column: TableColumn): string => {
    const text = column.label;
    const gap = (text.length < column.maxLength) ? ' '.repeat(column.maxLength - text.length) : '';
    return (column.align === 'right') ? `${gap}${underline(text)}` : `${underline(text)}${gap}`;
};

const drawBox = (lines: string[], color = yellow, horizontalPadding = 3): void => {
    const maxLineWidth = lines.reduce((max, row) => Math.max(max, strip(row).length), 0);

    console.log(color(`┌${'─'.repeat(maxLineWidth + (horizontalPadding * 2))}┐`));
    lines.forEach(row => {
        const padding = ' '.repeat(horizontalPadding);
        const fullRow = `${row}${' '.repeat(maxLineWidth - strip(row).length)}`;
        console.log(`${color('│')}${padding}${reset(fullRow)}${padding}${color('│')}`);
    });
    console.log(color(`└${'─'.repeat(maxLineWidth + (horizontalPadding * 2))}┘`));
};

const getTableColumns = (rows: TableRow[]): TableColumn[] => {
    const columns: TableColumn[] = [
        { label: 'Package', attrName: 'name', align: 'left', maxLength: 0, items: [] },
        { label: 'Location', attrName: 'location', align: 'left', maxLength: 0, items: [] },
        { label: 'Installed', attrName: 'installed', align: 'right', maxLength: 0, items: [] },
        { label: '', attrName: 'separator', align: 'center', maxLength: 0, items: [] },
        { label: 'Range', attrName: 'tagOrRange', align: 'right', maxLength: 0, items: [] },
        { label: '', attrName: 'separator', align: 'center', maxLength: 0, items: [] },
        { label: 'Wanted', attrName: 'wanted', align: 'right', maxLength: 0, items: [] },
        { label: 'Latest', attrName: 'latest', align: 'right', maxLength: 0, items: [] }
    ];
    rows.forEach(row =>
        columns.forEach(column => {
            column.maxLength = Math.max(column.label.length, column.maxLength, row[column.attrName]?.length || 0);
        })
    );
    return columns;
};

const getTableRows = (updates: LatestVersionPackage[]): TableRow[] => {
    return updates.reduce((all, pkg) => {
        const { name, latest, local, globalNpm, globalYarn, wantedTagOrRange, updatesAvailable } = pkg;
        const getGroup = (a?: string, b?: string): TableRowGroup => {
            if (b && (semverMajor(b) === 0)) {
                return 'majorVersionZero';
            } else if (a && b) {
                const releaseType = semverDiff(a, b) ?? '';
                if (['major', 'premajor', 'prerelease'].includes(releaseType)) {
                    return 'major';
                } else if (['minor', 'preminor'].includes(releaseType)) {
                    return 'minor';
                } else if (['patch', 'prepatch'].includes(releaseType)) {
                    return 'patch';
                }
            }
            return 'unknown';
        };
        const add = (group: TableRowGroup, location: string, installed?: string, wanted?: string) =>
            all.push({
                name: ' ' + (name ?? 'unknown'),
                location: location ?? 'unknown',
                installed: installed ?? 'unknown',
                latest: latest ?? 'unknown',
                tagOrRange: wantedTagOrRange ?? 'unknown',
                separator: '→',
                wanted: wanted ?? 'unknown',
                group
            });
        if (updatesAvailable) {
            if (updatesAvailable.local) {
                add(getGroup(local, updatesAvailable.local), 'local', local, updatesAvailable.local);
            }
            if (updatesAvailable.globalNpm) {
                add(getGroup(globalNpm, updatesAvailable.globalNpm), 'NPM global', globalNpm, updatesAvailable.globalNpm);
            }
            if (updatesAvailable.globalYarn) {
                add(getGroup(globalYarn, updatesAvailable.globalYarn), 'YARN global', globalYarn, updatesAvailable.globalYarn);
            }
        } else {
            if (local && (local !== latest)) {
                add(getGroup(local, latest), 'local', local, pkg.wanted);
            }
            if (globalNpm && (globalNpm !== latest)) {
                add(getGroup(globalNpm, latest), 'NPM global', globalNpm, pkg.wanted);
            }
            if (globalYarn && (globalYarn !== latest)) {
                add(getGroup(globalYarn, latest), 'YARN global', globalYarn, pkg.wanted);
            }
            if (!local && !globalNpm && !globalYarn) {
                add('unknown', 'unknown', 'unknown', pkg.wanted);
            }
        }
        return all;
    }, [] as TableRow[]);
};

const displayTable = (updates: LatestVersionPackage[]): void => {
    const rows = getTableRows(updates);
    if (rows.length) {
        const hasUpdates = rows.some(row => row.installed !== 'unknown');
        const columns = getTableColumns(rows);
        const columnGap = 2;

        const getGroupLines = (
            groupType: TableRowGroup, color: (str: string) => string, title: string, description?: string
        ): string[] => {
            const items = rows.filter(row => row.group === groupType).sort((a, b) => (a.name > b.name) ? 1 : -1);
            return (!items.length) ? [] : [
                '',
                color(`${bold(title)} ${italic(`(${description})`)}`),
                ...items.map(row => columns.map(column => columnCellRenderer(column, row)).join(' '.repeat(columnGap)))
            ];
        };

        drawBox([
            '',
            (hasUpdates) ? yellow('Important updates are available.') : undefined,
            (hasUpdates) ? '' : undefined,
            columns.map(columnHeaderRenderer).join(' '.repeat(columnGap)),
            ...getGroupLines('patch', green, 'Patch', 'backwards-compatible bug fixes'),
            ...getGroupLines('minor', cyan, 'Minor', 'backwards-compatible features'),
            ...getGroupLines('major', red, 'Major', 'potentially breaking API changes'),
            ...getGroupLines('majorVersionZero', magenta, 'Major version zero', 'not stable, anything may change'),
            ...getGroupLines('unknown', blue, 'Missing', 'not installed'),
            ''
        ].filter(line => line !== undefined) as string[]);
    } else {
        console.log(green('🎉 Packages are up-to-date'));
    }
};

const checkVersions = async (
    packages: Package | Package[] | PackageJson,
    skipMissing: boolean,
    options: LatestVersionOptions = { useCache: true }
): Promise<void> => {
    const ora = (await import('ora')).default;
    const spinner = ora({ text: cyan('Checking versions...') });
    spinner.start();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let latestVersionPackages: LatestVersionPackage[] = await latestVersion(packages, options);
    if (skipMissing) {
        latestVersionPackages = latestVersionPackages.filter(pkg => (pkg.local ?? pkg.globalNpm ?? pkg.globalYarn));
    }
    spinner.stop();
    displayTable(latestVersionPackages);
};

void (async () => {
    let args = process.argv.slice(2);

    const skipMissing = args.includes('--skip-missing');

    // Remove any options from the arguments
    args = args.filter(arg => !arg.startsWith('-'));

    // If argument is a package.json file
    if ((args.length === 1) && args[0].endsWith('package.json')) {
        if (existsSync(args[0])) {
            process.chdir(dirname(args[0]));
            await checkVersions(JSON.parse(readFileSync(args[0]).toString()) as PackageJson, skipMissing);
        } else {
            console.log(cyan('No package.json file were found'));
        }
    }
    // else..
    else {
        // Check if a local package.json file exists
        let localPkgJson: PackageJson | undefined;
        if (existsSync('package.json')) {
            localPkgJson = JSON.parse(readFileSync('package.json').toString());
        }

        // Check given arguments
        if (args.length) {
            // Map arguments with any range that could be found in local package.json
            args = args.map(arg => {
                if (localPkgJson?.dependencies?.[arg]) {
                    return `${arg}@${localPkgJson?.dependencies?.[arg]}`;
                } else if (localPkgJson?.devDependencies?.[arg]) {
                    return `${arg}@${localPkgJson?.devDependencies?.[arg]}`;
                } else if (localPkgJson?.peerDependencies?.[arg]) {
                    return `${arg}@${localPkgJson?.peerDependencies?.[arg]}`;
                }
                return arg;
            });
            await checkVersions(args, skipMissing);
        }
        // ...else check the local package.json if any
        else if (localPkgJson) {
            await checkVersions(localPkgJson, skipMissing);
        }
        // ...else do nothing
        else {
            console.log(cyan('No packages were found'));
        }
    }
})();
