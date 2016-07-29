/**
 * Created by IAO on 29/07/2016.
 */
'use strict';

// stdlib
var fs    = require('fs');
var path = require('path');

// 3rd-party
var argparse = require('argparse');
var _ = require('lodash');

// internal
var Edi = require('edifact-lib/dist/lib/edi.js');
var rootPath = path.resolve(__dirname, "..");

////////////////////////////////////////////////////////////////////////////////
var cli = new argparse.ArgumentParser({
    prog:     'edifact-edi-to-json',
    version:  require('./package.json').version,
    addHelp:  true
});

cli.addArgument([ '-i', '--in' ], {
    help:   'Input file. To use STDIN then use "-". Defaults to "-"',
    nargs:  '1',
    defaultValue: ['-']
});

cli.addArgument([ '-o', '--out' ], {
    help:   'File to write out to, utf-8 encoded without BOM. To use STDOUT then use "-". Defaults to "-"',
    nargs:  '1',
    defaultValue: ['-']
});

cli.addArgument([ '-s', '--schema' ], {
    help:   'Schema file or type to use. Types (vermas|contrl)',
    nargs:  '1',
    required: true
});

cli.addArgument([ '--segmentSeparator' ], {
    help:   'Segment separator. Defaults to \'',
    nargs:  '1',
    defaultValue: ['\'']
});

cli.addArgument([ '--dataElementSeparator' ], {
    help:   'Data Element separator. Defaults to "+"',
    nargs:  '1',
    defaultValue: ['+']
});

cli.addArgument([ '--dataComponentSeparator' ], {
    help:   'Data Component separator. Defaults to ":"',
    nargs:  '1',
    defaultValue: [':']
});

cli.addArgument([ '--releaseCharacter' ], {
    help:   'Release / Escape character. Defaults to "?"',
    nargs:  '1',
    defaultValue: ['?']
});

cli.addArgument([ '--pretty' ], {
    help:   'Pretty print output',
    action: 'storeTrue'
});

////////////////////////////////////////////////////////////////////////////////


var options = cli.parseArgs();
////////////////////////////////////////////////////////////////////////////////

var readFile = function (filename, encoding, callback) {
    if (filename === '-') {
        // read from stdin
        var chunks = [];

        process.stdin.on('data', function (chunk) {
            chunks.push(chunk);
        });

        setTimeout(function() {
            if(chunks.length == 0) {
                console.error("Use CTRL-D to end input");

                setTimeout(function() {
                    if(chunks.length == 0) {
                        callback({message: "Timeout reading stdin"});
                    }
                }, 10000);
            }
        }, 1000);

        process.stdin.on('end', function () {
            return callback(null, Buffer.concat(chunks).toString(encoding));
        });
    } else {
        fs.readFile(filename, encoding, callback);
    }
}

function getSchema(schemaFile) {
    //get internal schema
    var internalFile = path.resolve(__dirname, "schemas", schemaFile + '.json.schema');

    if (fs.existsSync(internalFile)) {
        //this is an internal reference
        var hslIntFile = fs.readFileSync(internalFile, 'utf8');
        return JSON.parse(hslIntFile);
    } else {
        throw new Error("Unable to find schema internal or external: " + options.schema);
    }
}

options.in = options.in[0];
options.out = options.out[0];
options.schema = options.schema[0];
options.segmentSeparator = options.segmentSeparator[0];
options.dataElementSeparator = options.dataElementSeparator[0];
options.dataComponentSeparator = options.dataComponentSeparator[0];
options.releaseCharacter = options.releaseCharacter[0];
options.pretty = options.pretty ? 3 : null;

readFile(options.in, 'utf8', function (error, input) {
    if (error) {
        if (error.code === 'ENOENT') {
            console.error('File not found: ' + options.in);
            process.exit(2);
        }

        console.error(
            options.trace && error.stack ||
            error.message ||
            String(error));

        process.exit(1);
    }

    try {
        let ediConfig = {
            segmentSeparator: options.segmentSeparator,
            dataElementSeparator: options.dataElementSeparator,
            dataComponentSeparator: options.dataComponentSeparator,
            releaseCharacter: options.releaseCharacter
        };

        let jsonSchema = getSchema(options.schema);
        let reader = new Edi.EdiSegmentReader(input, ediConfig);
        let edi = new Edi.Edi(jsonSchema);
        let output = JSON.stringify(edi.parse(reader), null, options.pretty);

        if(options.out === '-') {
            console.log(output);
        } else {
            fs.writeFileSync(options.out, output, 'utf8');
        }

        process.exit(0);
    } catch (e) {
        console.error("Error occured: " + e.toString());
        process.exit(1);
    }
});

