export const sleep = (time: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, time));
};

export const awaiter = async (
    check: () => boolean,
    retryTime: number = 150,
    timeFallback: number = 3000
): Promise<void> => {
    let isTimeOut = false;

    const timeoutId = setTimeout(() => {
        isTimeOut = true;
    }, timeFallback);

    try {
        while (check()) {
            if (isTimeOut) {
                throw new Error(`Awaiter: Timed out — ${timeFallback} ms exceeded`);
            }

            await sleep(retryTime);
        }
    } finally {
        clearTimeout(timeoutId);
    }
};
