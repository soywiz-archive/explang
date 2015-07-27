/// <reference path="./defs.d.ts" />

import ir = require('./ir');
import { IndentWriter, IndentedString, NameAlloc } from './utils';

class Generator {
	private binopRaw(e:ir.BinOpNode) {
		let func:string = null;
		let out = IndentedString.EMPTY;
        switch (e.op) {
            case '**': func = 'Math.pow'; break;
			case '...': func = '$ExpLang.range'; break;
			case '<=>': func = '$ExpLang.icomp'; break;
            default:
				if ([
					'=', '+=', '-=',
					'==', '!=', '<', '>', '<=', '>=', 
					'+', '-', '*', '/', '%',
					'|', '&',
				].indexOf(e.op) >= 0) {
					func = null;
				} else {
					throw new Error(`Unknown operator ${e.op}`);
				}
        }							
        if (func) out = out.with(`${func}(`);
        out = out.with(this.expr(e.l));
        out = out.with(func ? `, ` : ` ${e.op} `);
        out = out.with(this.expr(e.r));
        if (func) out = out.with(`)`);
		return out;
	}
	
	protected expr(e:ir.Expression):IndentedString {
		if (e == null) return IndentedString.EMPTY;
		var out = IndentedString.EMPTY;
		
		if (e instanceof ir.BinOpNode) {
            let type = e.type;
            switch (type) {
                case ir.Types.Int: return out.with('((').with(this.binopRaw(e)).with(')|0)');
                case ir.Types.Bool: return out.with('!!(').with(this.binopRaw(e)).with(')');
				case ir.Types.Iterable: return this.binopRaw(e);
                default:
                    throw new Error(`Unhandled type ${type}`);
            }
            //return this.w.write(`${node.value}`);
            return out;
        }
		if (e instanceof ir.ThisExpression) return IndentedString.EMPTY.with('this');
		if (e instanceof ir.MemberAccess) return IndentedString.EMPTY.with(this.expr(e.left)).with('.').with(e.member.name);
		if (e instanceof ir.ArrayAccess) return IndentedString.EMPTY.with(this.expr(e.left)).with('[').with(this.expr(e.index)).with(']');
		if (e instanceof ir.UnknownExpression) return IndentedString.EMPTY.with(`$unknown$`);
		if (e instanceof ir.ImmediateExpression) return IndentedString.EMPTY.with(`${e.value}`);
		if (e instanceof ir.MemberExpression) return IndentedString.EMPTY.with(`this.${e.member.name}`);
		if (e instanceof ir.ArgumentExpression) return IndentedString.EMPTY.with(`${e.arg.name}`);
		if (e instanceof ir.LocalExpression) return IndentedString.EMPTY.with(`${e.local.allocName}`);
		if (e instanceof ir.UnopPost) return IndentedString.EMPTY.with(this.expr(e.l)).with(e.op);
		if (e instanceof ir.CallExpression) {
			out = out.with(this.expr(e.left));
			out = out.with('(');
			for (var n = 0; n < e.args.length; n++) {
				if (n != 0) out = out.with(', ');
				out = out.with(this.expr(e.args[n]));
			}
			out = out.with(')');
			return out;
		}
		
		throw new Error(`Unhandled generate expression ${e}`);
	}
	
	protected stm(s:ir.Statement):IndentedString {
		if (s == null) return IndentedString.EMPTY;
		
		if (s instanceof ir.Statements) {
			let out = IndentedString.EMPTY;
			for (let c of s.nodes) out = out.with(this.stm(c));
			return out;
		}		
		if (s instanceof ir.ReturnNode) {
			return IndentedString.EMPTY.with('return ').with(this.expr(s.optValue)).with(';\n');
		}
		if (s instanceof ir.ExpressionStm) {
			return IndentedString.EMPTY.with(this.expr(s.expression)).with(';\n');
		}
		if (s instanceof ir.IfNode) {
			let out = IndentedString.EMPTY;
			out = out.with('if (').with(this.expr(s.e)).with(')');
			out = out.with('{').with(this.stm(s.t)).with('}');
			out = out.with('else {').with(this.stm(s.f)).with('}');
			return out;
		}
		if (s instanceof ir.ForNode) {
			let out = IndentedString.EMPTY;
			let TEMPNAME = this.method.names.alloc('__temp');
			out = out.with(`var ${TEMPNAME} = `).with(this.expr(s.expr)).with('.iterator();');
			out = out.with(`while (${TEMPNAME}.hasMore()) {`);
			out = out.with(s.local.allocName).with(' = ').with(`${TEMPNAME}.next();`);
			out = out.with(this.stm(s.body));
			out = out.with('}');
			//out = out.with('if (').with(this.expr(s.e)).with(')');
			//out = out.with('{').with(this.stm(s.t)).with('}');
			//out = out.with('else {').with(this.stm(s.f)).with('}');
			return out;
		}
		if (s instanceof ir.WhileNode) {
			let out = IndentedString.EMPTY;
			out = out.with('while (').with(this.expr(s.e)).with(')');
			out = out.with('{').with(this.stm(s.body)).with('}');
			return out;
		}
		throw new Error(`Unhandled generate statement ${s}`);
	}

	private method:ir.IrMethod;
    protected generateMethod(method:ir.IrMethod):IndentedString {
		this.method = method;
		let name = method.name;
        let className = method.containingClass.name;
		let out = IndentedString.EMPTY;
		let params = method.params.params;
		if (method.modifiers & ir.IrModifiers.STATIC) {
			out = out.with(`${className}.${name} = function(`);
		} else {
			out = out.with(`${className}.prototype.${name} = function(`);
		}
		for (let n = 0; n < params.length; n++) {
			let param = params[n];
			if (n != 0) out = out.with(', ');
			out = out.with(param.name);
		}
		out = out.with(`) {\n`);
		out = out.indent(() => {
			let out = IndentedString.EMPTY;
			for (let local of method.locals) {
				out = out.with('var ' + local.allocName);
				switch (local.type) {
					case ir.Types.Int: out = out.with(' = 0'); break;
					default: throw new Error("Unhandled type " + local.type);
				}
				out = out.with(';\n');
			}
			out = out.with(this.stm(method.body));
			return out;
		});
		out = out.with(`};\n`);
		return out;
    }
	
	protected generateClass(clazz:ir.IrClass):IndentedString {
        const name = clazz.name;
		let out = IndentedString.EMPTY;
		out = out.with(`var ${name} = (function () {\n`);
		out = out.indent(() => {
			let out = IndentedString.EMPTY;
			out = out.with(`function ${name}(`);
			out = out.with(`) { }\n`);
            for (const method of clazz.methods) {
                out = out.with(this.generateMethod(method));
            }
            out = out.with(`return ${name};\n`);
			return out;
		});
		out = out.with(`})();`);
		return out;
	}

	generateModule(module:ir.IrModule) {
		let out = IndentedString.EMPTY;
		for (const clazz of module.classes) {
			out = out.with(this.generateClass(clazz));
		}
		return out;
	}
}

export function generate(module:ir.IrModule):string {
	return new Generator().generateModule(module).toString();
}

export function generateRuntime():string {
	return `
		$ExpLang = {};
		$ExpLang.RangeIterator = (function() {
			function RangeIterator(min, max) { this.current = min; this.max = max; }
			RangeIterator.prototype.hasMore = function() { return this.current < this.max; };
			RangeIterator.prototype.next = function() { return this.current++; };
			return RangeIterator;
		})();
		$ExpLang.Range = (function() {
			function Range(min, max) { this.min = min; this.max = max; }
			Range.prototype.iterator = function() { return new ($ExpLang.RangeIterator)(this.min, this.max); }
			return Range;
		})();
		$ExpLang.range = function(min, max) { return new ($ExpLang.Range)(min, max); }
		$ExpLang.icomp = function(a, b) { if (a < b) return -1; else if (a > b) return +1; else return 0; }
	`;
}
