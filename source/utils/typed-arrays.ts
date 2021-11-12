// ? consider renaming this if we run into naming conflicts
export function areEqual(first?: Uint8Array, second?: Uint8Array) {
	if (first === undefined) return second === undefined
	if (second === undefined) return first === undefined
	if (first.length !== second.length) return false
	return first.every((value, index) => value === second[index])
}

export function stripLeadingZeros(byteArray: Uint8Array): Uint8Array {
	let i = 0
	for (; i < byteArray.length; ++i) {
		if (byteArray[i] !== 0) break
	}
	const result = new Uint8Array(byteArray.length - i)
	for (let j = 0; j < result.length; ++j) {
		result[j] = byteArray[i + j]
	}
	return result
}

export function toHexString(value: Uint8Array): `0x${string}` {
	return `0x${Array.from(value).map(x => x.toString(16).padStart(2, '0')).join('')}`
}

export function toUint8Array(value: string, length?: number): Uint8Array {
	const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(value)
	if (match === null) throw new Error(`Expected a hex string encoded byte array with an optional '0x' prefix but received ${value}`)
	const normalized = match[1]
	if (normalized.length % 2) throw new Error(`Hex string encoded byte array must be an even number of charcaters long.`)
	const bytes = new Uint8Array(length || normalized.length / 2)
	for (let i = 0; i < normalized.length; i += 2) {
		bytes[i/2] = Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16)
	}
	return new Uint8Array(bytes)
}
