/*
 * grunt-run
 * https://github.com/spenceralger/grunt-run
 *
 * Copyright (c) 2013 Spencer Alger
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  var runningProcs = [];
  var _ = require('lodash');
  var child_process = require('child_process');

  process.on('exit', function () {
    _.each(runningProcs, function (proc) {
      proc.kill();
    });
  });

  grunt.task.registerMultiTask('run', 'used to start external processes (like servers)', function () {
    var self = this;
    var name = this.target;
    var opts = this.options({
      wait: true,
      failOnError: true,
      ready: 1000
    });

    console.log(opts);

    var proc = child_process.spawn(
      self.data.cmd || 'node',
      self.data.args,
      {
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    proc.stdout.on('data', grunt.log.write);

    var done = this.async();
    var timeoutId = null;

    proc.stderr.on('data', function (chunk) {
      grunt.log.error(chunk);
      if (opts.failOnError) {
        proc.kill();
        done(new Error('Error output received'));
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    });

    proc.on('close', function () {
      var i;
      if ((i = runningProcs.indexOf(proc)) !== -1) {
        runningProcs.splice(i, 1);
      }
      grunt.log.debug('Process ' + name + ' closed.');
    });

    if (opts.wait) {
      proc.on('close', function (exitCode) {
        done(!exitCode);
      });
    } else {
      grunt.config.set('stop.' + name + '._pid', proc.pid);
      grunt.config.set('wait.' + name + '._pid', proc.pid);
      runningProcs.push(proc);
      if (opts.ready instanceof RegExp) {
        process.stdout.on('data', function (chunk) {
          if (opts.ready.test(chunk)) {
            done();
          }
        });
      } else if (opts.ready) {
        timeoutId = setTimeout(done, opts.ready);
      } else {
        process.nextTick(done);
      }
    }
  });

  grunt.task.registerMultiTask('stop', 'stop a process started with "run" ' +
    '(only works for tasks that use wait:false)', function () {
    var pid = this.data._pid;
    child_process.kill(pid);
  });

  grunt.task.registerMultiTask('wait', 'wait for a process started with "run" to close ' +
    '(only works for tasks that use wait:false)', function () {

    var pid = this.data._pid;
    var proc = _.find(runningProcs, { pid: pid });
    if (proc) {
      proc.on('close', this.async());
    } else {
      grunt.log.writeLn('process already closed');
    }
  });

};