'use strict';

const Busboy = require('busboy');
const FileAccumulator = require('./FileAccumulator');
const MultipartError = require('./MultipartError');

const appendField = require('append-field');
const onFinished = require('on-finished');

// From https://github.com/mscdex/busboy/blob/master/lib/types/multipart.js#L23
const rgxMultipartType = /^multipart\/form-data/i;

function handleReadable() {
  this.read();
}

function makeHook(fileLimits, requiredFiles, {limits, preservePath}) {
  const fieldNameSizeLimit = limits && typeof limits.fieldNameSize === 'number'
    ? limits.fieldNameSize
    : 100;

  return function multipartHook(req, res, next) {
    if (rgxMultipartType.test(req.headers['content-type']) === false) {
      next(new MultipartError('BAD_CONTENT_TYPE', req.headers['content-type']));
      return;
    }

    const busboy = new Busboy({headers: req.headers, preservePath, limits});
    const fileAccumulator = new FileAccumulator(fileLimits, handleError);
    const body = Object.create(null);

    function handleError(error) {
      req.stream.unpipe(busboy);
      req.stream.on('readable', handleReadable); // Drain the stream
      busboy.removeAllListeners();

      fileAccumulator.discardFiles();

      onFinished(req.stream, () => {
        next(error);
      });
    }

    busboy.on('error', handleError);
    busboy.on('fieldsLimit', () => handleError(new MultipartError('LIMIT_FIELD_COUNT')));
    busboy.on('filesLimit', () => handleError(new MultipartError('LIMIT_FILE_COUNT')));
    busboy.on('partsLimit', () => handleError(new MultipartError('LIMIT_PART_COUNT')));

    busboy.on('field', function onField(fieldName, value, fieldNameTruncated, valueTruncated) {
      // The '||' works around a bug in Busboy - https://github.com/mscdex/busboy/issues/6
      if (fieldNameTruncated || fieldName.length > fieldNameSizeLimit) {
        handleError(new MultipartError('LIMIT_FIELD_NAME'));
        return;
      }

      if (valueTruncated) {
        handleError(new MultipartError('LIMIT_FIELD_VALUE', fieldName));
        return;
      }

      appendField(body, fieldName, value);
    });

    busboy.on('file', function onFile(fieldName, fileStream, fileName, transferEncoding, mimeType) {
      if (fileName === undefined) {
        fileName = '';
      }

      // Work around bug in Busboy (https://github.com/mscdex/busboy/issues/6)
      if (fieldName.length > fieldNameSizeLimit) {
        fileStream.resume();
        handleError(new MultipartError('LIMIT_FIELD_NAME'));
        return;
      }

      const errorCode = fileAccumulator.addFile(fieldName, fileStream, fileName, mimeType);

      if (errorCode !== null) {
        fileStream.resume();
        handleError(new MultipartError(errorCode, fieldName));
      }
    });

    busboy.on('finish', () => {
      req.stream.unpipe(busboy);
      busboy.removeAllListeners();

      fileAccumulator.genFiles((files) => {
        // Ensure that all required files are accounted for
        for (let i = 0; i < requiredFiles.length; i++) {
          if (files[requiredFiles[i]] === undefined) {
            fileAccumulator.discardFiles();
            next(new MultipartError('MISSING_FILE', requiredFiles[i]));
            return;
          }
        }

        req.body = body;
        req.files = files;

        next();
      });
    });

    req.stream.pipe(busboy);
  };
}

module.exports = makeHook;
