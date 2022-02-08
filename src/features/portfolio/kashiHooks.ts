import { AddressZero } from '@ethersproject/constants'
import { Currency, CurrencyAmount, JSBI, Token } from '@sushiswap/core-sdk'
import { useKashiPairAddresses, useKashiPairs } from 'app/features/kashi/hooks'
import useSearchAndSort from 'app/hooks/useSearchAndSort'
import { useActiveWeb3React } from 'app/services/web3'
import { useMemo } from 'react'

export const reduceBalances = (balanceSources: CurrencyAmount<Currency>[]) =>
  Object.values(
    balanceSources.reduce<Record<string, CurrencyAmount<Currency>>>((acc, cur) => {
      if (cur.currency.isNative) {
        if (acc[AddressZero]) acc[AddressZero] = acc[AddressZero].add(cur)
        else acc[AddressZero] = cur
      } else if (acc[cur.currency.wrapped.address]) {
        acc[cur.currency.wrapped.address] = acc[cur.currency.wrapped.address].add(cur)
      } else {
        acc[cur.currency.wrapped.address] = cur
      }

      return acc
    }, {})
  )

export const useKashiBorrowPositions = (pairs: any[]) =>
  useSearchAndSort(
    pairs.filter((pair: any) => pair.userCollateralShare.gt(0) || pair.userBorrowPart.gt(0)),
    { keys: ['search'], threshold: 0.1 },
    { key: 'health.value', direction: 'descending' }
  )

export const useKashiLendPositions = (pairs: any[]) =>
  useSearchAndSort(
    pairs.filter((pair) => pair.userAssetFraction.gt(0)),
    { keys: ['search'], threshold: 0.1 },
    { key: 'currentUserAssetAmount.usdValue', direction: 'descending' }
  )

const useLendPositionAmounts = () => {
  const { chainId } = useActiveWeb3React()
  const addresses = useKashiPairAddresses()
  const pairs = useKashiPairs(addresses)

  return useKashiLendPositions(pairs).items.map((item) => {
    if (!chainId) return undefined

    const lentAsset = new Token(chainId, item.asset.address, item.asset.tokenInfo.decimals)
    const lentAssetAmount = JSBI.BigInt(item.currentUserAssetAmount.value.toString())
    return CurrencyAmount.fromRawAmount(lentAsset, lentAssetAmount)
  })
}

const useBorrowPositionAmounts = () => {
  const { chainId } = useActiveWeb3React()
  const addresses = useKashiPairAddresses()
  const pairs = useKashiPairs(addresses)

  return useKashiBorrowPositions(pairs).items.map((item) => {
    if (!chainId) return undefined

    const borrowedAsset = new Token(chainId, item.asset.address, item.asset.tokenInfo.decimals)
    const borrowedAssetAmount = JSBI.BigInt(item.currentUserBorrowAmount.value.toString())
    return CurrencyAmount.fromRawAmount(borrowedAsset, borrowedAssetAmount)
  })
}

const useCollateralPositionAmounts = () => {
  const { chainId } = useActiveWeb3React()
  const addresses = useKashiPairAddresses()
  const pairs = useKashiPairs(addresses)

  return useKashiBorrowPositions(pairs).items.map((item) => {
    if (!chainId) return undefined

    const collateralAsset = new Token(chainId, item.collateral.address, item.collateral.tokenInfo.decimals)
    const collateralAssetAmount = JSBI.BigInt(item.userCollateralAmount.value.toString())
    return CurrencyAmount.fromRawAmount(collateralAsset, collateralAssetAmount)
  })
}

export function useKashiPositions() {
  const borrowPositionAmounts = useBorrowPositionAmounts()
  const collateralPositionAmounts = useCollateralPositionAmounts()
  const lentPositionAmounts = useLendPositionAmounts()

  const kashiBalances = useMemo(
    () => reduceBalances([...collateralPositionAmounts, ...lentPositionAmounts]),
    [collateralPositionAmounts, lentPositionAmounts]
  )

  return {
    borrowed: borrowPositionAmounts,
    collateral: collateralPositionAmounts,
    lent: lentPositionAmounts,
    kashiBalances,
  }
}
