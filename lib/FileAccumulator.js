'use strict';

const MultipartError = require('./MultipartError');

const fs = require('fs');
const path = require('path');

const tmpDir = require('os').tmpdir();

var nextReqNum = 0;

class FileAccumulator {
  constructor(fileLimits, onError) {
    this._fileLimits = fileLimits;
    this._handleError = onError;
    this._files = {};
    this._fileCount = 0;
    this._filesFinished = 0;
    this._onFilesFinished = null;
    this._reqNum = nextReqNum;

    nextReqNum = (nextReqNum + 1) % Number.MAX_SAFE_INTEGER;
  }

  addFile(fieldName, fileStream, fileName, mimeType) {
    if (this._fileLimits === null) {
      const file = this._saveFile(fieldName, fileStream, fileName, mimeType);

      if (this._files[fieldName] === undefined) {
        this._files[fieldName] = [file];
      } else {
        this._files[fieldName].push(file);
      }

      return null;
    }

    if (this._fileLimits.hasOwnProperty(fieldName) === false) {
      return 'UNEXPECTED_FILE';
    }

    const maxFiles = this._fileLimits[fieldName];

    if (maxFiles < 1) {
      return 'LIMIT_FILE_COUNT';
    }

    if (maxFiles === 1) { // Expecting single file
      if (this._files[fieldName] !== undefined) {
        return 'LIMIT_FILE_COUNT';
      }
      this._files[fieldName] = this._saveFile(fieldName, fileStream, fileName, mimeType);
    } else { // Expecting array
      const filesArray = this._files[fieldName];

      if (filesArray === undefined) {
        this._files[fieldName] = [this._saveFile(fieldName, fileStream, fileName, mimeType)];
      } else {
        if (filesArray.length === maxFiles) {
          return 'LIMIT_FILE_COUNT';
        }
        filesArray.push(this._saveFile(fieldName, fileStream, fileName, mimeType));
      }
    }

    return null;
  }

  _saveFile(fieldName, fileStream, fileName, mimeType) {
    const tempPath = this._getTempFilePath(this._reqNum);
    const diskStream = fs.createWriteStream(tempPath);
    const handleDiskStreamFinish = this._handleFileFinished.bind(this);

    diskStream.on('error', this._handleError);
    diskStream.on('finish', handleDiskStreamFinish);

    fileStream.on('error', this._handleError);
    fileStream.on('limit', () => {
      this._handleError(new MultipartError('LIMIT_FILE_SIZE', fieldName));
    });

    fileStream.pipe(diskStream);

    return {
      fileName,
      fileStream,
      mimeType,
      diskStream,
      removeStreamListeners: () => {
        fileStream.removeAllListeners('limit');
        fileStream.removeListener('error', this._handleError);
        diskStream.removeListener('error', this._handleError);
        diskStream.removeListener('finish', handleDiskStreamFinish);
      },
    };
  }

  _getTempFilePath() {
    const fileName = `multipart.${process.pid}-${this._reqNum}-${this._fileCount++}.tmp`;

    return path.join(tmpDir, fileName);
  }

  _handleFileFinished() {
    this._filesFinished++;

    if (this._filesFinished === this._fileCount && this._onFilesFinished !== null) {
      this._onFilesFinished();
    }
  }

  genFiles(cb) {
    if (this._filesFinished === this._fileCount) { // Files are already finished
      this._genFiles(cb);
    } else {
      this._onFilesFinished = () => this._genFiles(cb);
    }
  }

  _genFiles(cb) {
    const files = Object.create(null);

    for (const fieldName in this._files) {
      const file = this._files[fieldName];

      files[fieldName] = Array.isArray(file)
        ? file.map(getUserFile)
        : getUserFile(file);
    }

    cb(files);
  }

  discardFiles() {
    for (const fieldName in this._files) {
      const file = this._files[fieldName];

      if (Array.isArray(file)) {
        file.forEach(discardFile);
      } else {
        discardFile(file);
      }
    }

    this._files = null;
  }
}

function getUserFile(file) {
  file.removeStreamListeners();

  const fileStream = fs.createReadStream(file.diskStream.path);
  fileStream.on('close', handleTempFileStreamClose);

  return {
    stream: fileStream,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.diskStream.bytesWritten,
  };
}

function discardFile(file) {
  const {fileStream, diskStream} = file;

  fileStream.unpipe(diskStream);
  file.removeStreamListeners();

  if (diskStream.closed) {
    fs.unlink(diskStream.path, ignoreErrors);
  } else {
    diskStream.on('close', handleTempFileStreamClose);
    diskStream.end();
  }

  fileStream.resume();
}

function handleTempFileStreamClose() {
  fs.unlink(this.path, ignoreErrors);
  this.removeListener('close', handleTempFileStreamClose);
}

function ignoreErrors() {
  // Empty function
}

module.exports = FileAccumulator;
