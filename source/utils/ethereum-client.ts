import fetch from 'node-fetch'
import { sleep } from './node'
import { ISignedTransaction, IUnsignedTransaction1559, serializeTransactionToString } from './ethereum'
import { parseBlock, parseBytes32, parseData, parseJsonRpcResponse, parseLogs, parseQuantity, parseTransactionReceipt, serializeAddress, serializeBytes32, serializeData, serializeQuantity, TransactionReceipt } from './wire'
import { PartiallyRequired } from './typescript'
import { agent } from './agent'

export class EthereumClient {
	private nextRequestId: number = 1

	public constructor(
		private readonly protocolHostPortPath: string
	) {}

	public readonly getLatestBlock = async () => {
		const block = await this.jsonRpcRequest('eth_getBlockByNumber', ['latest', false])
		return parseBlock(block)
	}

	public readonly getBalance = async (address: bigint) => {
		const response = await this.jsonRpcRequest('eth_getBalance', [serializeAddress(address), 'latest'])
		return parseQuantity(response)
	}

	public readonly getTransactionCount = async (address: bigint) => {
		const response = await this.jsonRpcRequest('eth_getTransactionCount', [serializeAddress(address), 'latest'])
		return parseQuantity(response)
	}

	public readonly getTransactionReceipt = async (hash: bigint) => {
		const response = await this.jsonRpcRequest('eth_getTransactionReceipt', [serializeBytes32(hash)])
		return parseTransactionReceipt(response)
	}

	public readonly call = async (transaction: PartiallyRequired<Partial<IUnsignedTransaction1559>, 'to' | 'data'>) => {
		const result = await this.jsonRpcRequest('eth_call', [{
			type: '0x2',
			...transaction.from ? { from: serializeAddress(transaction.from) } : {},
			...transaction.chainId ? { chainId: serializeQuantity(transaction.chainId) } : {},
			...transaction.nonce ? { nonce: serializeQuantity(transaction.nonce) } : {},
			...transaction.maxFeePerGas ? { maxFeePerGas: serializeQuantity(transaction.maxFeePerGas) } : {},
			...transaction.maxPriorityFeePerGas ? { maxPriorityFeePerGas: serializeQuantity(transaction.maxPriorityFeePerGas) } : {},
			...transaction.gasLimit ? { gas: serializeQuantity(transaction.gasLimit) } : {},
			to: transaction.to === null ? null : serializeAddress(transaction.to),
			...transaction.value ? { value: serializeQuantity(transaction.value) } : {},
			data: serializeData(transaction.data),
			...transaction.accessList ? { accessList: transaction.accessList.map(item => ({
				address: serializeAddress(item.address),
				storageKeys: item.storageKeys.map(serializeBytes32),
			}))} : {},
		}, 'latest'])

		return parseData(result)
	}

	public readonly sendSignedTransaction = async (transaction: ISignedTransaction) => {
		const response = await this.jsonRpcRequest('eth_sendRawTransaction', [serializeTransactionToString(transaction)])
		return parseBytes32(response)
	}

	public readonly getLogs = async (startBlock: bigint, endBlock: bigint | 'latest', contractAddress: bigint, topics: readonly bigint[]) => {
		const rawLogs = await this.jsonRpcRequest('eth_getLogs', [{
			fromBlock: serializeQuantity(startBlock),
			toBlock: endBlock === 'latest' ? 'latest' : serializeQuantity(endBlock),
			address: serializeAddress(contractAddress),
			topics: topics.map(serializeBytes32)
		}])
		return parseLogs(rawLogs)
	}

	private readonly jsonRpcRequest = async (method: string, params: readonly unknown[]) => {
		const request = { jsonrpc: '2.0', id: ++this.nextRequestId, method, params } as const
		const body = JSON.stringify(request)
		const response = await fetch(this.protocolHostPortPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, agent })
		if (!response.ok) throw new Error(`${response.status}: ${response.statusText}\n${await response.text()}`)
		const rawJsonRpcResponse = await response.json()
		const jsonRpcResponse = parseJsonRpcResponse(rawJsonRpcResponse)
		if ('error' in jsonRpcResponse) {
			throw new Error(`JSON-RPC Response Error:\nRequest:\n${JSON.stringify(request)}\nResponse:\n${JSON.stringify(rawJsonRpcResponse)}`)
		}
		return jsonRpcResponse.result
	}
}

export async function waitForReceipt(client: EthereumClient, transactionHash: bigint): Promise<Exclude<TransactionReceipt, null>>
export async function waitForReceipt(client: EthereumClient, transactionHash: bigint, timeoutMilliseconds?: number): Promise<TransactionReceipt>
export async function waitForReceipt(client: EthereumClient, transactionHash: bigint, timeoutMilliseconds?: number): Promise<TransactionReceipt> {
	const startTime = Date.now()
	while (true) {
		const receipt = await client.getTransactionReceipt(transactionHash)
		if (receipt !== null) return receipt
		if (timeoutMilliseconds !== undefined && Date.now() - startTime > timeoutMilliseconds) return null
		await sleep(250)
	}
}
