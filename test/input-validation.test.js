'use strict';

const assert = require('assert');
const multipart = require('../multipart');
const util = require('./utils/util');

describe('Input validation', () => {

  const app = util.makeMockApp();
  multipart(app); // Register the plugin manually

  it('should throw if expectedFiles is missing', () => {
    assert.throws(() => app.multipart(), /The `expectedFiles` option is required/);
  });

  it('should throw if expectedFiles is not an object or "ANY_FILES"', () => {
    assert.throws(
      () => app.multipart(null),
      /`expectedFiles` must be an object or "ANY_FILES"/
    );

    assert.throws(
      () => app.multipart('str'),
      /`expectedFiles` must be an object or "ANY_FILES"/
    );

    assert.throws(
      () => app.multipart(true),
      /`expectedFiles` must be an object or "ANY_FILES"/
    );

    assert.throws(
      () => app.multipart(10),
      /`expectedFiles` must be an object or "ANY_FILES"/
    );
  });

  it('should throw if any expectedFiles values are not an integer or an object', () => {
    assert.throws(
      () => app.multipart({field: 'str'}),
      /expectedFiles values must be an integer or an object/
    );

    assert.throws(
      () => app.multipart({field: undefined}),
      /expectedFiles values must be an integer or an object/
    );

    assert.throws(
      () => app.multipart({field: null}),
      /expectedFiles values must be an integer or an object/
    );

    assert.throws(
      () => app.multipart({field: 13.5}),
      /expectedFiles values must be an integer or an object/
    );

    assert.throws(
      () => app.multipart({good: 2, bad: true}),
      /expectedFiles values must be an integer or an object/
    );

    assert.throws(
      () => app.multipart({bad: () => null, good: 1}),
      /expectedFiles values must be an integer or an object/
    );
  });

  it('should throw if any expectedFiles object values do not have a valid maxCount value', () => {
    assert.throws(
      () => app.multipart({field: {}}),
      /expectedFiles object values must have a `maxCount` property that is an integer/
    );

    assert.throws(
      () => app.multipart({field: {maxCount: undefined}}),
      /expectedFiles object values must have a `maxCount` property that is an integer/
    );

    assert.throws(
      () => app.multipart({field: {maxCount: null}}),
      /expectedFiles object values must have a `maxCount` property that is an integer/
    );

    assert.throws(
      () => app.multipart({field: {maxCount: 13.5}}),
      /expectedFiles object values must have a `maxCount` property that is an integer/
    );

    assert.throws(
      () => app.multipart({
        good: {maxCount: 1},
        bad: {maxCount: true},
      }),
      /expectedFiles object values must have a `maxCount` property that is an integer/
    );

    assert.throws(
      () => app.multipart({
        bad: {maxCount: () => null},
        good: {maxCount: 30},
      }),
      /expectedFiles object values must have a `maxCount` property that is an integer/
    );
  });

});
