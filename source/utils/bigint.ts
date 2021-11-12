export function bigintToDecimalString(value: bigint, power: bigint): string {
	const integerPart = value / 10n**power
	const fractionalPart = value % 10n**power
	if (fractionalPart === 0n) {
		return integerPart.toString(10)
	} else {
		return `${integerPart.toString(10)}.${fractionalPart.toString(10).padStart(Number(power), '0').replace(/0+$/, '')}`
	}
}

export function attoString(value: bigint): string {
	return bigintToDecimalString(value, 18n)
}

export function nanoString(value: bigint): string {
	return bigintToDecimalString(value, 9n)
}

export function usdcString(value: bigint): string {
	return bigintToDecimalString(value, 6n)
}

export function attoethToEthDouble(value: bigint) {
	const decimalString = attoString(value)
	return Number.parseFloat(decimalString)
}

export function attoethToNanoethDouble(value: bigint) {
	const decimalString = nanoString(value)
	return Number.parseFloat(decimalString)
}

export function addressString(address: bigint) {
	return address.toString(16).padStart(40, '0')
}

export function bytes32String(bytes32: bigint) {
	return bytes32.toString(16).padStart(64, '0')
}

export function dataString(data: Uint8Array | null) {
	if (data === null) return ''
	return Array.from(data).map(x => x.toString(16).padStart(2,'0')).join('')
}

export function bigintToUint8Array(value: bigint, numberOfBytes: number) {
	if (value >= 2n ** BigInt(numberOfBytes * 8) || value < 0n) throw new Error(`Cannot fit ${value} into a ${numberOfBytes}-byte unsigned integer.`)
	const result = new Uint8Array(numberOfBytes)
	for (let i = 0; i < result.length; ++i) {
		result[i] = Number((value >> BigInt(numberOfBytes - i - 1) * 8n) & 0xffn)
	}
	return result
}

export function bigintToUint8ArrayLittleEndian(value: bigint, numberOfBytes: number) {
	if (value >= 2n ** BigInt(numberOfBytes * 8) || value < 0n) throw new Error(`Cannot fit ${value} into a ${numberOfBytes}-byte unsigned integer.`)
	const result = new Uint8Array(numberOfBytes)
	for (let i = 0; i < result.length; ++i) {
		result[i] = Number((value >> BigInt(i) * 8n) & 0xffn)
	}
	return result
}

export function stringToAtto(value: string): bigint {
	return decimalStringToBigint(value, 18)
}

export function stringToNano(value: string): bigint {
	return decimalStringToBigint(value, 9)
}

export function decimalStringToBigint(value: string, power: number): bigint {
	if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error(`Value is not a decimal string.`)
	let [integerPart, fractionalPart] = value.split('.')
	fractionalPart = (fractionalPart || '').padEnd(power, '0')
	return BigInt(`${integerPart}${fractionalPart}`)
}

export function squareRoot(value: bigint) {
	let z = (value + 1n) / 2n
	let y = value
	while (z - y < 0n) {
		y = z
		z = (value / z + z) / 2n
	}
	return y
}

export function stringifyJSONWithBigInts(value: any): string {
	return JSON.stringify(value, (_key, value) => {
		return typeof value === "bigint" ? `0x${value.toString(16)}n` : value
	}, 4)
}

export function bytesToUnsigned(bytes: Uint8Array): bigint {
	let value = 0n
	for (const byte of bytes) {
		value = (value << 8n) + BigInt(byte)
	}
	return value
}

export function bytesToUnsignedLittleEndian(bytes: Uint8Array): bigint {
	let value = 0n
	for (let i = bytes.length - 1; i >= 0; --i) {
		const byte = bytes[i]
		value = (value <<8n) + BigInt(byte)
	}
	return value
}

export function min(left: bigint, right: bigint): bigint {
	return left < right ? left : right
}

export function max(left: bigint, right: bigint): bigint {
	return left > right ? left : right
}

export function abs(x: bigint): bigint {
	return (x < 0n) ? -1n * x : x
}
