import { LocalStorage as SnowballLocalStorage } from "@snowballtools/js-sdk"
import { MMKV } from 'react-native-mmkv'

export class LocalStorage implements SnowballLocalStorage {

    storage = new MMKV()
  
    getItem(key: string): string | null {
      const value = this.storage.getString(key)
      return value ?? null
    }
  
    setItem(key: string, value: string): void {
      this.storage.set(key, value)
    }
  
    removeItem(key: string): void {
      this.storage.delete(key)
    }
  }