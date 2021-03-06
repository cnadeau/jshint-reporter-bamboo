/* global featureFile, scenarios, steps */
"use strict";

var path = require('path');
var _ = require('underscore');
var glob = require('glob');
var Yadda = require('yadda');

//setup paths
var cwd = process.cwd();
var directories = require(cwd + '/package.json').directories;
var testFeatures = cwd + path.sep + directories.test + path.sep;
if(directories.hasOwnProperty('testFeatures')){
    testFeatures = cwd + path.sep + directories.testFeatures + path.sep;
}
var tstGlob = [];
if(process.env.hasOwnProperty('YADDA_FEATURE_GLOB')){
    tstGlob = glob.sync(testFeatures + '**/*' + process.env.YADDA_FEATURE_GLOB + '*');
    tstGlob = _.map(tstGlob, function(dir){
        return dir.replace(/\//g, '\\');
    });
}

//setup logger
var bformat = require('bunyan-format');
var formatOut = bformat({ outputMode: 'short' });
var logger = require('bunyan').createLogger({name: 'TEST', stream: formatOut});

//execute all unit test feature files
var context = { world: { logger: logger } };
Yadda.plugins.mocha.StepLevelPlugin.init();
new Yadda.FeatureFileSearch([testFeatures]).each(function(file) {
    //check if in glob
    if(tstGlob.length === 0 || _.contains(tstGlob, file)){
        //construct featureLibraryPath by extracting feature file path minus the testFeatures path
        //the remaining path can be added to the testSteps path
        var featureLibraryPath = path.dirname(file);
        var featureLibraryDefault = file.replace(/\..+$/, '') + "-steps.js";

        featureFile(file, function(feature) {
            var loadedLibraries;
            var libraries = [];

            if(feature.annotations.libraries !== undefined){
                //load any libraries annotated in the feature file
                libraries = _.map(feature.annotations.libraries.split(', '), function(value){
                    return path.join(featureLibraryPath, value);
                });
            }
            libraries.push(featureLibraryDefault); //add default library

            //helper function to prepare multiple libraries for loading into the yadda interpreter
            function requireLibraries(libraries) {
                function requireLibrary(libraries, library) {
                    return libraries.concat(require(library));
                }
                return libraries.reduce(requireLibrary, []);
            }
            loadedLibraries = requireLibraries(libraries);

            var yadda = new Yadda.Yadda(loadedLibraries, context);
            scenarios(feature.scenarios, function(scenario) {
                steps(scenario.steps, function(step, done) {
                    yadda.yadda(step, done);
                });
            });
        });
    }
});