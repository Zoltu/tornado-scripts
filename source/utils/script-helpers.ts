import * as readline from 'readline'
import { ethereum, hdWallet, mnemonic } from '@zoltu/ethereum-crypto'
import { stringToAtto, stringToNano } from './bigint'
import { parseAddress } from './wire'

export function main(func: () => Promise<void>) {
	// necessary so @peculiar/webcrypto looks like browser WebCrypto, which @zoltu/ethereum-crypto needs
	import('@peculiar/webcrypto')
	.then(webcrypto => (globalThis as any).crypto = new webcrypto.Crypto())
	.then(func)
	.catch(error => {
		console.error('An error occurred.')
		console.error(error)
		if ('data' in error) console.error(error.data)
		debugger
		process.exit(1)
	})
}

export async function keepAlive() {
	return await new Promise(resolve => {
		process.on('SIGINT', () => resolve)
		process.on('SIGTERM', () => resolve)
	})
}

export async function promptForStringUnion<T extends string>(message: string, expected: readonly T[]) {
	return withPrompt(async prompt => {
		const value = await prompt(message)
		if (!expected.includes(value as T)) throw new Error(`${value} must be one of ${expected.join(' | ')}`)
		return value as T
	})
}

export async function promptForString(message: string) {
	return withPrompt(async prompt => await prompt(message))
}

export async function promptForInteger(message: string) {
	return withPrompt(async prompt => {
		const valueAsString = await prompt(message)
		if (!/[0-9]+/.test(valueAsString)) throw new Error(`${valueAsString} is not a base 10 integer.`)
		return Number.parseInt(valueAsString)
	})
}

export async function promptForPrivateKey() {
	return withPrompt(async prompt => {
		const wordsOrKey = await prompt('🔑 Mnemonic or Private Key: ')
		if (wordsOrKey.trim().length === 0) throw new Error(`Mnemonic or private key required, but received nothing.`)
		const privateKey = wordsOrKey.includes(' ')
			? await hdWallet.privateKeyFromSeed(await mnemonic.toSeed(wordsOrKey.split(' ')), await prompt(`🔖 Derivation Path (m/44'/60'/0'/0/0): `) || `m/44'/60'/0'/0/0`)
			: BigInt(wordsOrKey)
		return privateKey
	})
}

export async function promptForAddress(message: string, defaultValue: bigint | undefined = undefined) {
	return withPrompt(async prompt => {
		const addressString = await prompt(message)
		const address = (addressString !== '' || defaultValue === undefined)
			? parseAddress(addressString)
			: defaultValue
		if (addressString !== '' && /[A-F]/.test(addressString) && !(await ethereum.validateAddressChecksum(addressString))) throw new Error(`${addressString} checksum doesn't match.`)
		return address
	})
}

export async function promptForEth(message: string = `Amount (in ETH): `) {
	return withPrompt(async prompt => {
		const amountString = await prompt(message)
		const amount = stringToAtto(amountString)
		return amount
	})
}

export async function promptForGasFees() {
	return withPrompt(async prompt => {
		const maxFeeString = await prompt('💳 Maximum nanoeth per gas: ')
		const maxFeePerGas = stringToNano(maxFeeString)
		const priorityFeeString = await prompt('💳 Priority nanoeth per gas: ')
		const maxPriorityFeePerGas = stringToNano(priorityFeeString)
		return { maxFeePerGas, maxPriorityFeePerGas }
	})
}

export async function promptForFunctionCallDetails() {
	return withPrompt(async prompt => {
		const signature = await prompt(`Function Signature (balanceOf(address)): `) || 'balanceOf(address)'
		const parametersString = await prompt('Parameters (comma separated integers, 0x prefix for hex, arrays and tuples not supported): ')
		const parameters = parametersString.split(',').filter(x => x !== '').map(BigInt)
		return { signature, parameters }
	})
}

export async function promptForEnterKey() {
	return withPrompt(async prompt => {
		await prompt(`Press enter to continue.`)
	})
}

export async function withPrompt<T>(func: (prompt: Prompt) => Promise<T>): Promise<T> {
	const readlineInterface = readline.createInterface({ input: process.stdin, output: process.stdout })
	const prompt = (prompt: string) => new Promise<string>(resolve => readlineInterface.question(prompt, resolve))

	const result = await func(prompt)

	readlineInterface.close()
	return result
}

type Prompt = (prompt: string) => Promise<string>
