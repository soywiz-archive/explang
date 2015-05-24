declare module "assert" {
	export function equal<T>(a:T, b:T):void;
	export function deepEqual<T>(a:T, b:T):void;
}

declare function describe(name:string, func: () => void):void;
declare function it(name:string, func: () => void):void;
