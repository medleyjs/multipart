'use strict';

const FormData = require('form-data');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const os = require('os');

function makeMockApp() {
  return {
    decorate(name, value) {
      this[name] = value;
    },
    decorateRequest() {
      // Mock does nothing
    },
    addBodyParser() {
      // Mock does nothing
    },
  };
}

function getFile(fileName) {
  return fs.createReadStream(path.join(__dirname, '..', 'fixtures', fileName));
}

function getFileString(fileName) {
  // eslint-disable-next-line no-sync
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', fileName), 'utf8');
}

function createForm(formFields) {
  const form = new FormData();

  for (const fieldName in formFields) {
    const field = formFields[fieldName];

    if (Array.isArray(field)) {
      field.forEach(file => form.append(fieldName, file));
    } else {
      form.append(fieldName, field);
    }
  }

  return form;
}

function submitForm(formFields, hook, cb) {
  const form = formFields instanceof FormData ? formFields : createForm(formFields);
  const req = {
    headers: form.getHeaders({'transfer-encoding': 'chunked'}),
    stream: new stream.PassThrough(),
    body: undefined,
    files: undefined,
  };

  req.stream.complete = false;
  form.once('end', () => {
    req.stream.complete = true;
  });

  form.pipe(req.stream);

  hook(req, null, err => cb(err, req));
}

function assertTempFilesWereDeleted(done) {
  setTimeout(() => {
    fs.readdir(os.tmpdir(), (err, files) => {
      assert.ifError(err);

      files.forEach((fileName) => {
        assert.strictEqual(/^multipart\..*\.tmp$/.test(fileName), false,
          fileName + ' file was not deleted');
      });

      done();
    });
  }, 20); // Wait for async unlinks to finish
}

module.exports = {
  makeMockApp,
  getFile,
  getFileString,
  createForm,
  submitForm,
  assertTempFilesWereDeleted,
};
