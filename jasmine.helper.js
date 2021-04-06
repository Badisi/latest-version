const SpecReporter = require('jasmine-spec-reporter').SpecReporter;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
    spec: { displayPending: true }
}));
