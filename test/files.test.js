'use strict';

const FormData = require('form-data');
const MultipartError = require('../lib/MultipartError');

const assert = require('assert');
const fs = require('fs');
const multipart = require('../multipart');
const util = require('./utils/util');

describe('Files', () => {

  after(util.assertTempFilesWereDeleted);

  const app = util.makeMockApp();
  multipart(app);

  it('should parse a single file', (done) => {
    const hook = app.multipart({
      file: 1,
    });
    const form = {file: util.getFile('text.txt')};

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);

      const {file} = req.files;

      assert.strictEqual(file.fileName, 'text.txt');
      assert.strictEqual(file.mimeType, 'text/plain');
      assert.strictEqual(file.stream instanceof fs.ReadStream, true);
      assert.strictEqual(file.size, 16);

      let fileString = '';

      file.stream
        .on('data', (buffer) => {
          fileString += buffer.toString('utf8');
        })
        .on('end', () => {
          assert.strictEqual(fileString, util.getFileString('text.txt'));
          done();
        })
        .on('error', done);
    });
  });

  it('should parse multiple single files', (done) => {
    const hook = app.multipart({
      textFile: 1,
      htmlFile: 1,
    });
    const form = {
      textFile: util.getFile('text.txt'),
      htmlFile: util.getFile('streams.html'),
    };

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);

      multipart.discardFiles(req.files); // Clean up before assertions

      const {textFile, htmlFile} = req.files;

      assert.strictEqual(textFile.fileName, 'text.txt');
      assert.strictEqual(textFile.mimeType, 'text/plain');
      assert.strictEqual(textFile.stream instanceof fs.ReadStream, true);
      assert.strictEqual(textFile.size, 16);

      assert.strictEqual(htmlFile.fileName, 'streams.html');
      assert.strictEqual(htmlFile.mimeType, 'text/html');
      assert.strictEqual(htmlFile.stream instanceof fs.ReadStream, true);
      assert.strictEqual(htmlFile.size, 141995);

      done();
    });
  });

  it('should parse arrays of files', (done) => {
    const hook = app.multipart({
      files: 2,
    });
    const form = {
      files: [
        util.getFile('text.txt'),
        util.getFile('streams.html'),
      ],
    };

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);

      multipart.discardFiles(req.files); // Clean up before assertions

      const {files} = req.files;

      assert.strictEqual(files[0].fileName, 'text.txt');
      assert.strictEqual(files[0].mimeType, 'text/plain');
      assert.strictEqual(files[0].stream instanceof fs.ReadStream, true);
      assert.strictEqual(files[0].size, 16);

      assert.strictEqual(files[1].fileName, 'streams.html');
      assert.strictEqual(files[1].mimeType, 'text/html');
      assert.strictEqual(files[1].stream instanceof fs.ReadStream, true);
      assert.strictEqual(files[1].size, 141995);

      done();
    });
  });

  it('should always parse files into arrays when there are no expectedFiles', (done) => {
    const hook = app.multipart('ANY_FILES');
    const form = {
      textFiles: [
        util.getFile('text.txt'),
        util.getFile('streams.html'),
      ],
      images: util.getFile('cat.jpg'),
    };

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);

      multipart.discardFiles(req.files); // Clean up before assertions

      const {textFiles, images} = req.files;

      assert.strictEqual(textFiles[0].fileName, 'text.txt');
      assert.strictEqual(textFiles[0].mimeType, 'text/plain');
      assert.strictEqual(textFiles[0].stream instanceof fs.ReadStream, true);
      assert.strictEqual(textFiles[0].size, 16);

      assert.strictEqual(textFiles[1].fileName, 'streams.html');
      assert.strictEqual(textFiles[1].mimeType, 'text/html');
      assert.strictEqual(textFiles[1].stream instanceof fs.ReadStream, true);
      assert.strictEqual(textFiles[1].size, 141995);

      assert.strictEqual(images[0].fileName, 'cat.jpg');
      assert.strictEqual(images[0].mimeType, 'image/jpeg');
      assert.strictEqual(images[0].stream instanceof fs.ReadStream, true);
      assert.strictEqual(images[0].size, 156145);

      done();
    });
  });

  it('should parse empty files', (done) => {
    const hook = app.multipart({
      emptyFile: {maxCount: 1},
    });
    const form = {emptyFile: util.getFile('empty.dat')};

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);

      multipart.discardFiles(req.files); // Clean up before assertions

      const {emptyFile} = req.files;

      assert.strictEqual(emptyFile.fileName, 'empty.dat');
      assert.strictEqual(emptyFile.mimeType, 'application/octet-stream');
      assert.strictEqual(emptyFile.stream instanceof fs.ReadStream, true);
      assert.strictEqual(emptyFile.size, 0);

      done();
    });
  });

  it('should respect the `preservePath` option', (done) => {
    const hook = app.multipart({file: 1}, {preservePath: true});
    const form = new FormData();

    form.append('file', util.getFile('text.txt'), {
      filepath: '/home/me/text.txt',
    });

    util.submitForm(form, hook, (err, req) => {
      assert.ifError(err);

      multipart.discardFiles(req.files); // Clean up before assertions

      const {file} = req.files;

      assert.strictEqual(file.fileName, '/home/me/text.txt');
      assert.strictEqual(file.mimeType, 'text/plain');
      assert.strictEqual(file.stream instanceof fs.ReadStream, true);
      assert.strictEqual(file.size, 16);

      done();
    });
  });

  it('should set the fileName to the empty string if a file name was not provided by the client', (done) => {
    const hook = app.multipart({unnamedFile: 1});
    const file = util.getFile('text.txt');
    file.path = undefined;

    util.submitForm({unnamedFile: file}, hook, (err, req) => {
      assert.ifError(err);

      multipart.discardFiles(req.files); // Clean up before assertions

      const {unnamedFile} = req.files;

      assert.strictEqual(unnamedFile.fileName, '');
      assert.strictEqual(unnamedFile.mimeType, 'application/octet-stream');
      assert.strictEqual(unnamedFile.stream instanceof fs.ReadStream, true);
      assert.strictEqual(unnamedFile.size, 16);

      done();
    });
  });


  describe('Errors', () => {

    describe('UNEXPECTED_FILE error', () => {

      it('should be returned if an unexpected file is received', (done) => {
        const hook = app.multipart({expectedFile: 1});
        const form = {notExpectedFile: util.getFile('text.txt')};

        util.submitForm(form, hook, (err) => {
          assert.deepStrictEqual(err, new MultipartError('UNEXPECTED_FILE', 'notExpectedFile'));
          done();
        });
      });

      it('should be returned if a file is received when no files are expected', (done) => {
        const hook = app.multipart({});
        const form = {file: util.getFile('text.txt')};

        util.submitForm(form, hook, (err) => {
          assert.deepStrictEqual(err, new MultipartError('UNEXPECTED_FILE', 'file'));
          done();
        });
      });

    });


    describe('MISSING_FILE error', () => {

      it('should be returned if a required file is not received', (done) => {
        const hook = app.multipart({expectedFile: 1});
        const form = {bodyField: 'text'};

        util.submitForm(form, hook, (err) => {
          assert.deepStrictEqual(err, new MultipartError('MISSING_FILE', 'expectedFile'));
          done();
        });
      });

      it('should not be returned if optional files are not received', (done) => {
        const hook = app.multipart({
          expectedFile: 1,
          optionalFiles: {maxCount: 2, optional: true},
        });
        const form = {expectedFile: util.getFile('text.txt')};

        util.submitForm(form, hook, (err, req) => {
          multipart.discardFiles(req.files); // Clean up before assertions

          assert.ifError(err);
          assert.deepStrictEqual(Object.keys(req.files), ['expectedFile']);

          done();
        });
      });

    });


    describe('LIMIT_FILE_COUNT error', () => {

      it('should be returned if an extra file is received for a single file field', (done) => {
        const hook = app.multipart({file: 1});
        const form = {
          file: [
            util.getFile('text.txt'),
            util.getFile('text.txt'),
          ],
        };

        util.submitForm(form, hook, (err) => {
          assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_COUNT', 'file'));
          done();
        });
      });

      it('should be returned if an extra file is received for an array file field', (done) => {
        const hook = app.multipart({file: 2});
        const form = {
          file: [
            util.getFile('text.txt'),
            util.getFile('streams.html'),
            util.getFile('cat.jpg'),
          ],
        };

        util.submitForm(form, hook, (err) => {
          assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_COUNT', 'file'));
          done();
        });
      });

      it('should be returned if any files are received for a file limit less than 1', (done) => {
        const hook = app.multipart({file: 0});
        const form = {
          file: util.getFile('text.txt'),
        };

        util.submitForm(form, hook, (err) => {
          assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_COUNT', 'file'));
          done();
        });
      });

    });

  });

});
