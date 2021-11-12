import { toHexString, toUint8Array } from './typed-arrays'

export function parseAddress(value: string) {
	if (typeof value !== 'string') throw new Error(`Expected a string but got a ${typeof value}\n${value}`)
	if (!/^0x([a-fA-F0-9]{40})$/.test(value)) throw new Error(`${value} is not a hex string encoded address.`)
	else return BigInt(value)
}

export function parseQuantity(value: unknown) {
	if (typeof value !== 'string') throw new Error(`Expected a string but got a ${typeof value}\n${value}`)
	if (!/^0x([a-fA-F0-9]{1,64})$/.test(value)) throw new Error(`${value} is not a hex string encoded number.`)
	else return BigInt(value)
}

export function parseBytes32(value: unknown) {
	if (typeof value !== 'string') throw new Error(`Expected a string but got a ${typeof value}\n${value}`)
	if (!/^0x([a-fA-F0-9]{64})$/.test(value)) throw new Error(`${value} is not a hex string encoded 32 byte value.`)
	else return BigInt(value)
}

export function parseData(value: unknown) {
	if (typeof value !== 'string') throw new Error(`Expected a string but got a ${typeof value}\n${value}`)
	return toUint8Array(value)
}

export function parseBlock(block: unknown) {
	if (typeof block !== 'object' || block === null) throw new Error(`Expected an object but got a ${typeof block}\n${block}`)
	assertPropertyWithType(block, 'parentHash', assertIsHexString)
	assertPropertyWithType(block, 'sha3Uncles', assertIsHexString)
	assertPropertyWithType(block, 'miner', assertIsHexString)
	assertPropertyWithType(block, 'stateRoot', assertIsHexString)
	assertPropertyWithType(block, 'transactionsRoot', assertIsHexString)
	assertPropertyWithType(block, 'receiptsRoot', assertIsHexString)
	assertPropertyWithType(block, 'logsBloom', assertIsHexString)
	assertPropertyWithType(block, 'difficulty', assertIsHexString)
	assertPropertyWithType(block, 'number', assertIsHexString)
	assertPropertyWithType(block, 'gasLimit', assertIsHexString)
	assertPropertyWithType(block, 'gasUsed', assertIsHexString)
	assertPropertyWithType(block, 'timestamp', assertIsHexString)
	assertPropertyWithType(block, 'extraData', assertIsHexString)
	assertPropertyWithType(block, 'mixHash', assertIsHexString)
	assertPropertyWithType(block, 'nonce', assertIsHexString)
	assertPropertyWithType(block, 'totalDifficulty', assertIsHexString)
	assertPropertyWithType(block, 'baseFeePerGas', assertIsHexString)
	assertPropertyWithType(block, 'transactions', getArrayAsserter(assertIsHexString))
	assertPropertyWithType(block, 'uncles', getArrayAsserter(assertIsHexString))
	return {
		parentHash: BigInt(block.parentHash),
		number: BigInt(block.number),
		timestamp: new Date(Number.parseInt(block.timestamp, 16) * 1000),
		gasLimit: BigInt(block.gasLimit),
		gasUsed: BigInt(block.gasUsed),
		baseFeePerGas: BigInt(block.baseFeePerGas),
	} as const
}

export function parseTransactionReceipt(receipt: unknown) {
	if (typeof receipt !== 'object') throw new Error(`Expected an object but got a ${typeof receipt}\n${receipt}`)
	if (receipt === null) return null
	assertPropertyWithType(receipt, 'type', assertIsHexString)
	assertPropertyWithType(receipt, 'blockHash', assertIsHexString)
	assertPropertyWithType(receipt, 'blockNumber', assertIsHexString)
	assertPropertyWithType(receipt, 'transactionHash', assertIsHexString)
	assertPropertyWithType(receipt, 'transactionIndex', assertIsHexString)
	assertPropertyWithType(receipt, 'contractAddress', assertIsHexStringOrNull)
	assertPropertyWithType(receipt, 'cumulativeGasUsed', assertIsHexString)
	assertPropertyWithType(receipt, 'gasUsed', assertIsHexString)
	assertPropertyWithType(receipt, 'from', assertIsHexString)
	assertPropertyWithType(receipt, 'to', assertIsHexStringOrNull)
	assertPropertyWithType(receipt, 'status', assertIsHexString)
	// expectPropertyWithType(receipt, 'logs', assertIsArray)
	// expectPropertyWithType(receipt, 'logsBloom', assertIsHexString)

	return {
		type: BigInt(receipt.type),
		blockHash: BigInt(receipt.blockHash),
		bolckNumber: BigInt(receipt.blockNumber),
		transactionHash: BigInt(receipt.transactionHash),
		transactionIndex: BigInt(receipt.transactionIndex),
		contractAddress: receipt.contractAddress === null ? null : BigInt(receipt.contractAddress),
		cumulativeGasUsed: BigInt(receipt.cumulativeGasUsed),
		gasUsed: BigInt(receipt.gasUsed),
		from: BigInt(receipt.from),
		to: receipt.to === null ? null : BigInt(receipt.to),
		status: BigInt(receipt.status) === 0n ? 'failure' : 'success' as const,
		// logs: receipt.logs.map(parseLogs)
		// logsBloom: toUint8Array(receipt.logsBloom),
	} as const
}
export type TransactionReceipt = ReturnType<typeof parseTransactionReceipt>

export interface Log {
	blockHash: bigint
	blockNumber: bigint
	transactionHash: bigint
	transactionIndex: bigint
	address: bigint
	topics: bigint[]
	data: Uint8Array
}
export function parseLogs(value: unknown) {
	if (!Array.isArray(value)) throw new Error(`Expected array of logs but got not an array.\n${JSON.stringify(value)}`)
	return value.map(parseLog)
}
export function parseLog(log: unknown): Log {
	if (typeof log !== 'object' || log === null) throw new Error(`Expected an object but got a ${typeof log}\n${log}`)
	assertPropertyWithType(log, 'blockHash', assertIsHexString)
	assertPropertyWithType(log, 'blockNumber', assertIsHexString)
	assertPropertyWithType(log, 'transactionHash', assertIsHexString)
	assertPropertyWithType(log, 'transactionIndex', assertIsHexString)
	assertPropertyWithType(log, 'address', assertIsHexString)
	assertPropertyWithType(log, 'topics', getArrayAsserter(assertIsHexString))
	assertPropertyWithType(log, 'data', assertIsHexString)
	return {
		blockHash: BigInt(log.blockHash),
		blockNumber: BigInt(log.blockNumber),
		transactionHash: BigInt(log.transactionHash),
		transactionIndex: BigInt(log.transactionIndex),
		address: BigInt(log.address),
		topics: log.topics.map(BigInt),
		data: toUint8Array(log.data),
	}
}

export function parseJsonRpcResponse(response: unknown) {
	if (typeof response !== 'object' || response === null) throw new Error(`Expected an object but got a ${typeof response}\n${response}`)
	assertPropertyWithType(response, 'jsonrpc', getStringLiteralAsserter('2.0'))
	assertProperty(response, 'id')
	if (hasProperty(response, 'result')) {
		return response
	} else if (hasProperty(response, 'error')) {
		const error = response.error
		if (typeof error !== 'object' || error === null) throw new Error(`Expected an object but got a ${typeof error}\n${error}`)
		assertPropertyWithType(error, 'code', assertIsNumber)
		assertPropertyWithType(error, 'message', assertIsString)
		return { ...response, error }
	} else {
		throw new Error(`Expected either a 'result' or a 'response' property on object but found neither.\n${JSON.stringify(response)}`)
	}
}



export function serializeAddress(address: bigint): `0x${string}` {
	return `0x${address.toString(16).padStart(40, '0')}`
}

export function serializeBytes32(value: bigint): `0x${string}` {
	return `0x${value.toString(16).padStart(64, '0')}`
}

export function serializeQuantity(value: bigint): `0x${string}` {
	return `0x${value.toString(16)}`
}

export function serializeData(value: Uint8Array): `0x${string}` {
	return toHexString(value)
}



export function hasProperty<K extends string>(thing: object, key: K): thing is { [Keys in K]: unknown } {
	return key in thing
}

export function assertProperty<K extends string>(thing: object, key: K): asserts thing is { [Keys in K]: unknown } {
	if (!(key in thing)) throw new Error(`Expected field '${key}' in object but it wasn't present.\n${JSON.stringify(thing)}`)
}

export function assertPropertyWithType<K extends string, V>(thing: object, key: K, typeAssertion: (value: unknown) => asserts value is V): asserts thing is { readonly [Keys in K]: V } {
	assertProperty(thing, key)
	typeAssertion(thing[key])
}

function getArrayAsserter<T>(typeAssertion: (value: unknown) => asserts value is T) {
	function assertIsArrayOfType(array: unknown): asserts array is readonly T[] {
		if (!Array.isArray(array)) throw new Error(`Expected an array but got a ${typeof array}\n${JSON.stringify(array)}`)
		for (const item of array) {
			typeAssertion(item)
		}
	}
	return assertIsArrayOfType
}

export function assertIsNumber(value: unknown): asserts value is number {
	if (typeof value !== 'number') throw new Error(`Expected a number but got a ${typeof value}\n${value}`)
}

export function assertIsString(value: unknown): asserts value is string {
	if (typeof value !== 'string') throw new Error(`Expected a string but got a ${typeof value}\n${value}`)
}

export function assertIsHexString(value: unknown): asserts value is `0x${string}` {
	assertIsString(value)
	if (!/^0x([a-fA-F0-9]*)$/.test(value)) throw new Error(`${value} is not a hex string.`)
}

function assertIsHexStringOrNull(value: unknown): asserts value is `0x${string}` | null {
	if (value === null) return
	assertIsHexString(value)
}

function getStringLiteralAsserter<T extends string>(literal: T) {
	function assertIsStringLiteral<T extends string>(value: unknown): asserts value is T {
		if (value !== literal) throw new Error(`Expected a ${literal} but got a ${value}`)
	}
	return assertIsStringLiteral
}
