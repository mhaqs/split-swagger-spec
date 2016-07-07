var path = require('path');

module.exports = function(grunt) {

    var serveStatic = require('serve-static');

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        gitclone: {
          setup: {
            options: {
              repository: 'https://github.com/swagger-api/swagger-ui.git',
              directory: 'swagger-ui'
            }
          }
        },

        gitpull: {
          setup: {
            options: {
              cwd: 'swagger-ui'
            }
          }
        },

        watch: {
          livereload: {
            options: {
                base: 'spec',
                livereload: true,
            },
            files: [
              'swagger-ui/dist/**',
              'spec/**'
            ],
            tasks: [ 'copy', 'buildSwagger' ]
          },
        },

        connect: {
          options: {
            hostname: 'localhost',
            port:      grunt.option('port') || 1337
          },

//TODO: Fix the middleware for proper api live publishing and reloading
          livereload: {
            options: {
              /*middleware: function (connect) {
                return [    
                require('connect-livereload')(),
                ];
              }*/
            }
          }
        },

        open: {
          server: {
            url: 'http://localhost:<%= connect.options.port %>/'
          }
        },

        copy: {
            default: {
                files: [
                    {expand: true, cwd: 'swagger-ui/dist/', src: ['**'], dest: 'site/'},
                    {expand: true, src: ['index.html'], dest: 'site/'},
                ]
            }
        },

        buildSwagger: {
            default: {
                options: {
                    dir: 'spec',
                    input: 'index.yaml',
                    output: 'site/spec.yaml',
                }
            },
        },

        verifySwagger: {
            default: {
                options: {
                    dir: 'spec/site',
                    input: 'spec.yaml',
                }
            },
        },
    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-open');
    grunt.loadNpmTasks('grunt-git');
    grunt.loadNpmTasks("grunt-contrib-watch");
    
    if (grunt.file.exists('swagger-ui')) {
        grunt.registerTask('setup', [
            'gitpull',
            'copy',
            'buildSwagger'
        ]);
    } else {
        grunt.registerTask('setup', [
            'gitclone',
            'gitpull',
            'copy',
            'buildSwagger'
        ]);
    }

    grunt.registerTask('server', [
        'copy',
        'buildSwagger',
        'connect:livereload',
        'open',
        'watch'
    ]);
    grunt.registerTask('swag', [
        'buildSwagger'
    ]);
    grunt.registerTask('test', [
        'buildSwagger',
        'verifySwagger'
    ]);
    grunt.registerTask('build', [
        'test',
        'setup'
    ]);
  
    function flattenSwagger(dir, indexfile) {
        var fs = require('fs');
        process.chdir(dir);

        var YAML = require('js-yaml');
        var resolveRefs = require('json-refs').resolveRefs;

        var root = YAML.safeLoad(fs.readFileSync(indexfile).toString());

        var options = {
          filter:['relative','remote'],  
          loaderOptions: {
            processContent: function (res, callback) {
              callback(undefined, YAML.safeLoad(res.text));
            }
          }
        };

        return resolveRefs(root, options).then(function (results) {
            return Promise.resolve(YAML.safeDump(results.resolved));
        }, function (err) {
            return Promise.reject(err);
        });
    }

// Builds the swagger spec file.
    grunt.registerMultiTask('buildSwagger', 'Build swagger docs into a single file', function() {
        var o = this.options();

        var done = this.async();
        flattenSwagger(o.dir, o.input).then(function (flattened_yaml) {
            grunt.file.write(o.output, flattened_yaml);
            return done();
        }, function (err) {
            return done(err);
        });

    });

    function validateCreateSwaggerApi (options) {
      return function (theApi) {
        var assert = require('assert');

        assert.deepEqual(theApi.definition, theApi.definition);
        //assert.equal(theApi.documentationUrl,
        //             'https://github.com/swagger-api/swagger-spec/blob/master/versions/2.0.md');
        assert.deepEqual(theApi.options, options);
        assert.equal(theApi.version, '2.0');

        // Make sure all references were found
        _.forEach(theApi.references, function (details) {
          assert.ok(!_.has(details, 'missing'));
        });

        // Validate the merging of the Swagger definition properties and the SwaggerApi properties
        _.forEach(helpers.swaggerDoc, function (val, key) {
          assert.deepEqual(theApi[key], val);
        });

        // Validate the operations (Simple tests for now, deeper testing is below)
        assert.ok(_.isArray(theApi.pathObjects));
        assert.ok(theApi.pathObjects.length > 0);

        // Validate the registration of customValidator on SwaggerApi
        assert.deepEqual(theApi.customValidators, options.customValidators || [])
      };
    }

    grunt.registerMultiTask('verifySwagger', 'Verify swagger docs', function() {
        var o = this.options();

        var Sway = require('sway');
        var done = this.async();
        var options = {
                    definition: path.join(__dirname, o.dir, o.input)
            };
        //process.chdir(o.dir);
        Sway.create(options)
            .then(validateCreateSwaggerApi(options))
            .then(done, done);
    });

};
