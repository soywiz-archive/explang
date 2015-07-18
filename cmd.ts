/// <reference path="./defs.d.ts" />

import vfs = require('./vfs');
import compiler = require('./compiler');
import lang_services = require('./lang_services');

declare function require(name:string):any;
declare class Buffer { constructor(data:any); }
declare var process:any;

var interpreter:string = process.argv[0];
var script:string = process.argv[1];
var argv:string[] = process.argv.slice(2);

console.log('CMD');
console.log(argv);
vfs.cwd();

console.log(lang_services.compile(vfs.cwd().access('test.exp')));
