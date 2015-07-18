/// <reference path="./defs.d.ts" />

import vfs = require('./vfs');

declare function require(name:string):any;
declare class Buffer { constructor(data:any); }
declare var process:any;

console.log('CMD');
vfs.cwd();