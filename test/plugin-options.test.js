'use strict';

const assert = require('assert');
const proxyquire = require('proxyquire');
const util = require('./utils/util');

const multipart = proxyquire('../multipart', {
  './lib/makeHook'(fileLimits, requiredFiles, options) {
    return options;
  },
});

describe('Plugin Options', () => {

  it('should use global plugin options', () => {
    const app = util.makeMockApp();
    multipart(app, {
      preservePath: true,
      limits: {files: 2},
    });

    const options = app.multipart('ANY_FILES');

    assert.deepStrictEqual(options, {
      preservePath: true,
      limits: {files: 2},
    });
  });

  it('should use hook options', () => {
    const app = util.makeMockApp();
    multipart(app);

    const options = app.multipart({files: 4}, {
      limits: {parts: 3},
    });

    assert.deepStrictEqual(options, {
      preservePath: undefined,
      limits: {parts: 3},
    });
  });

  it('should merge global and hook options', () => {
    const app = util.makeMockApp();
    multipart(app, {
      preservePath: false,
      limits: {parts: 20},
    });

    const options = app.multipart({
      files: {maxCount: 4},
    }, {
      preservePath: true,
      limits: {files: 5},
    });

    assert.deepStrictEqual(options, {
      preservePath: true,
      limits: {parts: 20, files: 5},
    });
  });

});
