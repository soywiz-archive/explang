interface Class<T> { new(...args:any[]):T; }
interface NumberDictionary<T> { [key:number]:T; }
interface StringDictionary<T> { [key:string]:T; }

declare class Set<T> {
	
}

declare class Map<K, V> {
	get(key:K):V;
	set(key:K, value:V):V;
	has(key:K):boolean;
}

declare class TextEncoder {
	constructor(encoding:string);
	encode(str:string):Uint8Array;
	decode(data:Uint8Array):string;
}