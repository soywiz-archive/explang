import lang_desc = require('./lang_desc');
import d = require('./lang_desc2');
import { N } from './lang_desc2';

//@d.Seq('1') class TEST extends d.N { }
@d.EReg(/^\d[\d_]*/) export class Int extends N {
	get value():number { return lang_desc.parseInt2(this.element.text); }
}

//console.log(d.match2(d.list(TEST, null, 1), '1111') + '');
//console.log(d.match2(d.list(TEST, ',', 1), '1,1,1,1') + '');
//console.log(d.match(lang_desc.Int, '999') + '');
console.log(Int);
console.log('' + d.match(lang_desc.Expr, '1+1'));
