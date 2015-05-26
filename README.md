Experimental language
==========================

[![Build Status](https://travis-ci.org/soywiz/explang.svg?branch=master)](https://travis-ci.org/soywiz/explang)

The idea of this language is to explore some great features found in other languages like:
typescript, haxe, scala, swift, d, C#, F#

Avoiding their pitfalls. 

Design include these things in mind:
* DRY: Don't repeat yourself!
* Compiler should be fast
* Should be familiar
* Language tools are as important as the language itself, so tools out of the box and portable
* Should be able to refactor/rename
* C# nameof() is a great way to allow refactoring -> #define TOSTRING(name) #name
* Stuff like PosInfo haxe/c# allow to debug without stacktraces
* Most errors should be detected at editing time and when not possible compile time
* Static-typed with dynamic access
* Able to generate asm.js without emscripten
* No runtime: language should be able to target several platforms
* Targeting javascript (web/new browsers/console node.js), flash/swf (web/old browsers/adobe air ios) and java (android) at least.
* Readable
* Context-free grammar
* No macros/preprocessor: d's static if for conditional compilation at body positions; no stange code generation or stuff just available after compiling
* Compensate lack of macros with good features
* Optional support ast-node access at runtime to enable DSL (code to glsl, linq to sql...)
* await/async and generators out of the box
* No custom-operators or all-is-an-operator to avoid strange DSLs, but enable operator overloading 
* Getters should be easy
* Subscripts
* No keyword new for instantiating objects
* Extensions (adding methods to completed classes, interfaces + allow closed classes to fullfil interfaces like in swift)
* Code should read from left to right, reading first the subject and then reading transformations, so extensions are great when not abused. 
* Avoid verbosity without making the language complex or hard to read
* Not too flexible (slow or hard to read), not too strict (few or poor features)
* One single way of doing things (code should be consistent)
* Avoid writing types as much as possible, except in specific places to ensure compiler is fast
* Small and easy to read lambdas
* Support for integer types (not just numbers like in javascript)
* Support for value types (structures) that doesn't impact GC
* AOT compiling
* Constructor should have a single name: constructor/__constructor/new, not the class name
* Named parameters

DRY:
* Constructors should allow to declare fields like typescript, scala
* The name of getters should appear just once

Static Typing:
*

Refactoring:
*

Services:
* Listing types and dependencies
* Renaming
* Determining implementations and overriders
* Extract
