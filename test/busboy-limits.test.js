'use strict';

const MultipartError = require('../lib/MultipartError');

const assert = require('assert');
const multipart = require('../multipart');
const util = require('./utils/util');

describe('Busboy limits', () => {

  after(util.assertTempFilesWereDeleted);

  const app = util.makeMockApp();
  multipart(app);

  describe('fieldNameSize', () => {

    it('should error if the limit is exceeded with a file field', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {fieldNameSize: 5},
      });
      const form = {tooLongFieldName: util.getFile('text.txt')};

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FIELD_NAME'));
        done();
      });
    });

    it('should error if the limit is exceeded with a text field in a multipart form', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {fieldNameSize: 5},
      });
      const form = {
        file: util.getFile('text.txt'),
        tooLongFieldName: 'text field',
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FIELD_NAME'));
        done();
      });
    });

    it('should error if the default limit is exceeded', (done) => {
      const hook = app.multipart('ANY_FILES');
      const form = {
        ['a'.repeat(101)]: util.getFile('text.txt'),
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FIELD_NAME'));
        done();
      });
    });

  });


  describe('fieldSize', () => {

    it('should error if the limit is exceeded', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {fieldSize: 5},
      });
      const form = {age: '123456'};

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FIELD_VALUE', 'age'));
        done();
      });
    });

  });


  describe('fields', () => {

    it('should error if the limit is exceeded', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {fields: 3},
      });
      const form = {a: 1, b: 2, c: 3, d: 4};

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FIELD_COUNT'));
        done();
      });
    });

  });


  describe('fileSize', () => {

    it('should error if the limit is exceeded with one file', (done) => {
      const hook = app.multipart({textFile: 1}, {
        limits: {fileSize: 9},
      });
      const form = {textFile: util.getFile('text.txt')};

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_SIZE', 'textFile'));
        done();
      });
    });

    it('should error if the limit is exceeded with one of multiple files', (done) => {
      const hook = app.multipart({
        textFile: 1,
        htmlFile: 1,
      }, {
        limits: {fileSize: 100},
      });
      const form = {
        textFile: util.getFile('text.txt'),
        htmlFile: util.getFile('streams.html'),
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_SIZE', 'htmlFile'));
        done();
      });
    });

    it('should error, having handled if a file was already finished writing to disk', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {fileSize: 150000},
      });
      const form = {
        emptyFile: util.getFile('empty.dat'),
        textFile: util.getFile('text.txt'),
        htmlFile: util.getFile('streams.html'),
        imageFile: util.getFile('cat.jpg'),
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_SIZE', 'imageFile'));
        done();
      });
    });

  });


  describe('files', () => {

    it('should error if the limit is exceeded', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {files: 1},
      });
      const form = {
        textFile: util.getFile('text.txt'),
        htmlFile: util.getFile('streams.html'),
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_COUNT'));
        done();
      });
    });

    it('should error if a limit of 0 is exceeded', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {files: 0},
      });
      const form = {
        textFile: util.getFile('text.txt'),
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_FILE_COUNT'));
        done();
      });
    });

  });


  describe('parts', () => {

    it('should error if the limit is exceeded because of files', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {parts: 1},
      });
      const form = {
        textFile: util.getFile('text.txt'),
        htmlFile: util.getFile('streams.html'),
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_PART_COUNT'));
        done();
      });
    });

    it('should error if the limit is exceeded because of fields', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {parts: 1},
      });
      const form = {a: 1, b: 2};

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_PART_COUNT'));
        done();
      });
    });

    it('should error if the limit is exceeded because of files and fields', (done) => {
      const hook = app.multipart('ANY_FILES', {
        limits: {parts: 2},
      });
      const form = {
        file: util.getFile('text.txt'),
        field: 'val',
        field2: 'val2',
      };

      util.submitForm(form, hook, (err) => {
        assert.deepStrictEqual(err, new MultipartError('LIMIT_PART_COUNT'));
        done();
      });
    });

  });

});
