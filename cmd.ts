/// <reference path="./defs.d.ts" />

import vfs = require('./vfs');
import compiler = require('./compiler');
import services = require('./services');

declare function require(name:string):any;
declare class Buffer { constructor(data:any); }
declare var process:any;

var interpreter:string = process.argv[0];
var script:string = process.argv[1];
var argv:string[] = process.argv.slice(2);

//console.log('CMD');
//console.log(argv);
vfs.cwd();

let showCode = false;
let filename:string = null;

while (argv.length > 0) {
	let arg = argv.shift();
	if (arg.substr(0, 1) == '-') {
		switch (arg) {
			case '-c': showCode = true; break;
			default: throw new Error(`Unknown switch ${arg}`);
		}
	} else {
		filename = arg;
	}
}

if (filename == null) {
	console.log('explang [-c] <file.exp>');
	process.exit(-1);
} else {
	let code:string = null;
	try {
		 code = services.compile(vfs.cwd().access(filename));
	} catch (e) {
		if (e instanceof TypeError) {
			console.log(e.stack);
		} else if (e instanceof Error) {
			console.log(e.stack);
			//console.log(e.message);
		} else {
			console.log(e);
		}
	}
	if (showCode) {
		console.log(code)
	} else {
		if (code != null) console.log(eval(code));
	}
}

