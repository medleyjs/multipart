'use strict';

const FormData = require('form-data');
const MultipartError = require('../lib/MultipartError');

const assert = require('assert');
const fs = require('fs');
const medley = require('@medley/medley');
const multipart = require('../multipart');
const util = require('./utils/util');

function request(app, form, cb) {
  app.listen(0, (err) => {
    if (err) {
      cb(err);
      return;
    }

    app.server.unref();

    form.submit('http://localhost:' + app.server.address().port, (err, res) => {
      if (err) {
        cb(err);
        return;
      }

      res.resume();
      cb(null, res);
    });
  });
}

describe('Medley Integration', () => {

  after(util.assertTempFilesWereDeleted);

  it('should parse files and fields', (done) => {
    const app = medley();

    multipart(app);

    const form = new FormData();

    form.append('emptyFile', util.getFile('empty.dat'));
    form.append('emptyFileLabel', 'EMPTY');
    form.append('textFiles', util.getFile('text.txt'));
    form.append('textFiles', util.getFile('streams.html'));
    form.append('textFilesLabel', 'TEXT');
    form.append('image', util.getFile('cat.jpg'));
    form.append('imageDescription', 'A picture of a cat');

    app.post('/', [
      app.multipart({
        emptyFile: 1,
        textFiles: 2,
        image: {maxCount: 1},
        others: {maxCount: 10, optional: true},
      }),
    ], function handler(req, res) {
      multipart.discardFiles(req.files); // Clean up before assertions

      const {emptyFile, textFiles, image} = req.files;

      assert.strictEqual(emptyFile.fileName, 'empty.dat');
      assert.strictEqual(emptyFile.mimeType, 'application/octet-stream');
      assert.strictEqual(emptyFile.stream instanceof fs.ReadStream, true);
      assert.strictEqual(emptyFile.size, 0);

      assert.strictEqual(textFiles[0].fileName, 'text.txt');
      assert.strictEqual(textFiles[0].mimeType, 'text/plain');
      assert.strictEqual(textFiles[0].stream instanceof fs.ReadStream, true);
      assert.strictEqual(textFiles[0].size, 16);

      assert.strictEqual(textFiles[1].fileName, 'streams.html');
      assert.strictEqual(textFiles[1].mimeType, 'text/html');
      assert.strictEqual(textFiles[1].stream instanceof fs.ReadStream, true);
      assert.strictEqual(textFiles[1].size, 141995);

      assert.strictEqual(image.fileName, 'cat.jpg');
      assert.strictEqual(image.mimeType, 'image/jpeg');
      assert.strictEqual(image.stream instanceof fs.ReadStream, true);
      assert.strictEqual(image.size, 156145);

      assert.strictEqual(req.files.others, undefined);

      assert.deepEqual(req.body, {
        emptyFileLabel: 'EMPTY',
        textFilesLabel: 'TEXT',
        imageDescription: 'A picture of a cat',
      });

      res.send();
    });

    request(app, form, (err, res) => {
      assert.ifError(err);
      assert.strictEqual(res.statusCode, 200);

      app.close(done);
    });
  });

  it('should work when a MultipartError occurs', (done) => {
    const app = medley();

    multipart(app, {
      limits: {fileSize: 100000},
    });

    const form = new FormData();

    form.append('emptyFile', util.getFile('empty.dat'));
    form.append('emptyFileLabel', 'EMPTY');
    form.append('bigFile', util.getFile('streams.html'));

    app.post('/', [
      app.multipart({
        emptyFile: 1,
        bigFile: 1,
      }),
    ], function handler() {
      assert.fail('The route handler should not be called');
    });

    app.setErrorHandler((err, req, res) => {
      assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_SIZE', 'bigFile'));
      assert.deepStrictEqual(req.body, undefined);
      assert.deepStrictEqual(req.files, undefined);

      res.send('');
    });

    request(app, form, (err, res) => {
      assert.ifError(err);
      assert.strictEqual(res.statusCode, 400);

      app.close(done);
    });
  });

});
