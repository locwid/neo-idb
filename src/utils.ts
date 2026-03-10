export const requestToPromise = <T>(request: IDBRequest): Promise<T> =>
  new Promise<T>((resolve) => {
    request.onsuccess = () => resolve(request.result as T)
  })
