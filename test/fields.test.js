'use strict';

const FormData = require('form-data');
const MultipartError = require('../lib/MultipartError');

const assert = require('assert');
const makeHook = require('../lib/makeHook');
const stream = require('stream');
const util = require('./utils/util');
const w3cTestData = require('testdata-w3c-json-form');

describe('Fields', () => {

  const hook = makeHook({}, [], {});

  it('should process multiple fields', (done) => {
    const form = {
      org: 'medleyjs',
      repo: 'multipart',
      scope: '@medley',
    };

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);
      assert.deepEqual(req.body, {
        org: 'medleyjs',
        repo: 'multipart',
        scope: '@medley',
      });
      done();
    });
  });

  it('should process empty fields', (done) => {
    const form = {
      key: 'value',
      empty: '',
      checkboxfull: ['cb1', 'cb2'],
      checkboxhalfempty: ['cb1', ''],
      checkboxempty: ['', ''],
    };

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);
      assert.deepEqual(req.body, {
        key: 'value',
        empty: '',
        checkboxfull: ['cb1', 'cb2'],
        checkboxhalfempty: ['cb1', ''],
        checkboxempty: ['', ''],
      });
      done();
    });
  });

  it('should error on non-multipart requests', (done) => {
    const req = {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': 9,
      },
      stream: new stream.PassThrough(),
    };

    req.stream.end('key=value');

    hook(req, null, (err) => {
      assert.deepStrictEqual(
        err,
        new MultipartError('BAD_CONTENT_TYPE', 'application/x-www-form-urlencoded')
      );
      assert.strictEqual(req.hasOwnProperty('body'), false);
      assert.strictEqual(req.hasOwnProperty('files'), false);
      done();
    });
  });

  w3cTestData.forEach((testData) => {
    it('should handle ' + testData.name, (done) => {
      const form = new FormData();

      testData.fields.forEach((field) => {
        form.append(field.key, field.value);
      });

      util.submitForm(form, hook, (err, req) => {
        assert.ifError(err);
        assert.deepEqual(req.body, testData.expected);
        done();
      });
    });
  });

});
