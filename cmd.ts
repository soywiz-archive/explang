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

if (argv.length == 0) {
	console.log('explang <file.exp>');
	process.exit(-1);
}
let code = services.compile(vfs.cwd().access(argv[0]));
//console.log(code);
console.log(eval(code));
