import {
    EmbeddedAttestParams,
    EmbeddedAuthBase,
    EmbeddedConfigOptions,
    EmbeddedLoginParams,
    EmbeddedWalletClientParams,
    MakeAuthOptions,
  } from '@snowballtools/js-sdk'

import { PasskeyStamper, createPasskey } from "@turnkey/react-native-passkey-stamper";
import { TurnkeyClient } from "@turnkey/http";

import { createAccountSync } from '@turnkey/viem'
import { createWalletClient } from 'viem'

export class EmbeddedAuth extends EmbeddedAuthBase {
    static className = 'EmbeddedAuth' as const
    override readonly className = 'EmbeddedAuth' as const
  
    stamper: PasskeyStamper | undefined = undefined
  
    static configure(opts: EmbeddedConfigOptions) {
  
      return (makeOpts: MakeAuthOptions, prev?: EmbeddedAuth) => {
        const instance = new this(makeOpts, opts)
        if (prev && makeOpts.chain.vmType === prev?.chain.vmType) {
          // Share auth state
          instance._state = prev._state
  
          // Create new wallet client with new chain
          if (prev.state.name === 'wallet-ready' && prev._wallet) {
            const params = {
              ...prev._wallet.params,
              chain: makeOpts.chain,
            }
            const client = instance.makeWalletClient(params)
            instance._wallet = { client, params }
          }
        }
        return instance
      }
    }
  
    makeWalletClient(params: EmbeddedWalletClientParams) {
      this.stamper = new PasskeyStamper({
        rpId: params.rpId,
        allowCredentials: params.credentialIds.map((credentialId) => ({
          id: credentialId,
          type: 'public-key',
        })),
      })
  
      const httpClient = new TurnkeyClient(
        {
          baseUrl: params.baseUrl,
        },
        this.stamper!,
      )
  
      // Create the Viem custom account
      const turnkeyAccount = createAccountSync({
        client: httpClient,
        organizationId: params.organizationId,
        signWith: params.walletAddress,
      })
  
      const wallet = createWalletClient({
        account: turnkeyAccount,
        chain: params.chain.toViemChain(),
        transport: params.transport,
      })
  
      return wallet
    }
  
    async assertLogin({ challenge }: EmbeddedLoginParams) {
      return JSON.parse((await this.stamper!.stamp(challenge)).stampHeaderValue) as {
        authenticatorData: string
        clientDataJson: string
        credentialId: string
        signature: string
      }
    }
  
    async attestPasskey(params: EmbeddedAttestParams) {
      const credential = await createPasskey({
        authenticatorName: 'End-User Passkey',
        rp: {
          id: params.rpId,
          name: 'Passkey App',
        },
        user: {
          id: params.orgId,
          name: params.name,
          displayName: `${params.name} (${renderTimestamp()})`,
        },
      })
      return {
        credential: {
          encodedChallenge: credential.challenge,
          attestation: {
            credentialId: credential.attestation.credentialId,
            clientDataJson: credential.attestation.clientDataJson,
            attestationObject: credential.attestation.attestationObject,
            transports: credential.attestation.transports,
          },
        },
      }
    }
  }
  
  const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')
  
  function renderTimestamp() {
    const date = new Date()
    const month = MONTHS[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()
  
    let hours = date.getHours()
    const minutes = date.getMinutes()
  
    const ampm = hours >= 12 ? 'pm' : 'am'
    hours = hours % 12
    hours = hours ? hours : 12 // the hour '0' should be '12'
  
    const minutesStr = minutes < 10 ? '0' + minutes : minutes.toString()
  
    return `${month} ${day} ${year} ${hours}:${minutesStr}${ampm}`
  }
  