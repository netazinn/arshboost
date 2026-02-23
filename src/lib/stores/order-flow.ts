'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { OrderFlowState, Game, GameService } from '@/types'

interface OrderFlowActions {
  setStep: (step: OrderFlowState['step']) => void
  setGame: (game: Game) => void
  setService: (service: GameService) => void
  setOrderDetails: (details: Record<string, unknown>) => void
  setTotalPrice: (price: number) => void
  reset: () => void
}

const initialState: OrderFlowState = {
  step: 1,
  selectedGame: null,
  selectedService: null,
  orderDetails: {},
  totalPrice: 0,
}

export const useOrderFlowStore = create<OrderFlowState & OrderFlowActions>()(
  persist(
    (set) => ({
      ...initialState,
      setStep: (step) => set({ step }),
      setGame: (game) => set({ selectedGame: game, selectedService: null, step: 2 }),
      setService: (service) => set({ selectedService: service, step: 3 }),
      setOrderDetails: (details) => set({ orderDetails: details }),
      setTotalPrice: (price) => set({ totalPrice: price }),
      reset: () => set(initialState),
    }),
    {
      name: 'arshboost-order-flow',
      partialize: (state) => ({
        step: state.step,
        selectedGame: state.selectedGame,
        selectedService: state.selectedService,
        orderDetails: state.orderDetails,
        totalPrice: state.totalPrice,
      }),
    }
  )
)
