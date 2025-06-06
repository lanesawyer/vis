import partial from 'lodash/partial';
import type { AsyncDataCache } from './dataset-cache';

/**
 * FrameLifecycle type that defines the functions a user can call to interact with the frame lifecycle.
 *
 * Currently only supports `cancelFrame` to allow the user to cancel the frame on an ad-hoc basis.
 */
export type FrameLifecycle = {
    cancelFrame: (reason?: string) => void;
};

/**
 * NormalStatus type that defines the possible non-error statuses for a frame.
 *
 * `begun` - The frame has started running
 *
 * `finished` - The frame has finished running
 *
 * `cancelled` - The frame was cancelled by the user
 *
 * `finished_synchronously` - The frame finished synchronously
 *
 * `progress` - The frame is still running and has not finished
 */
export type NormalStatus = 'begun' | 'finished' | 'cancelled' | 'finished_synchronously' | 'progress';
export type RenderCallback = (event: { status: NormalStatus } | { status: 'error'; error: unknown }) => void;
/**
 * `beingLongRunningFrame` starts a long-running frame that will render a list of items asynchronously based on
 * the provided data, settings, and rendering functions.
 *
 * The frame will run until all items have been rendered, or until the user cancels the frame. It will update the
 * provided cache so that the data is available for other frames that may be running. This function is safe to call
 * multiple times in different areas of your code, as it will complete quickly if/when all the data is already cached and available.
 *
 * You can listen for the status of the frame, allowing you to make decisions based on the progress of the frame.
 *
 * In addition, you can cancel the frame at any time, which will stop the frame from running and prevent any further
 * rendering or data fetching from occurring.
 *
 * @deprecated consider using beginFrame instead
 * @param maximumInflightAsyncTasks The maximum number of async tasks to run at once.
 * @param queueProcessingIntervalMS The length of time to wait between processing the queue in milliseconds.
 * @param items An array of generic items to render
 * @param mutableCache The asynchronous cache used to store the data
 * @param settings Flexible object of settings related to the items that are being rendered
 * @param requestsForItem a function which returns a mapping of "columns" to async functions that would fetch the column
 * @param render The main render function that will be called once all data is available
 * @param lifecycleCallback Callback function so they user can be notified of the status of the frame
 * @param cacheKeyForRequest A function for generating a cache key for a given request key, item, and settings. Defaults to the request key if not provided.
 * @param queueTimeBudgetMS the maximum ammount of time (milliseconds) to spend rendering before yeilding to allow other work to run - rendering will resume next frame (@param queueProcessingIntervalMS)
 * @returns A FrameLifecycle object with a cancelFrame function to allow users to cancel the frame when necessary
 */
export function beginLongRunningFrame<Column, Item, Settings>(
    maximumInflightAsyncTasks: number,
    queueProcessingIntervalMS: number,
    items: Item[],
    mutableCache: AsyncDataCache<string, string, Column>,
    settings: Settings,
    requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
    render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
    lifecycleCallback: RenderCallback,
    cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string = (key) => key,
    queueTimeBudgetMS: number = queueProcessingIntervalMS / 3,
): FrameLifecycle {
    const abort = new AbortController();
    const queue: Item[] = [];
    const taskCancelCallbacks: Array<() => void> = [];

    const reportNormalStatus = (status: NormalStatus) => {
        // we want to report our status, however the flow of events can be confusing -
        // our callers anticipate an asynchronous (long running) frame to be started,
        // but there are scenarios in which the whole thing is completely synchronous
        // callers who are scheduling things may be surprised that their frame finished
        // before the code that handles it appears to start. thus, we make the entire lifecycle callback
        // system async, to prevent surprises.
        Promise.resolve().then(() => lifecycleCallback({ status }));
    };
    // when starting a frame, we greedily attempt to render any tasks that are already in the cache
    // however, if there is too much overhead (or too many tasks) we would risk hogging the main thread
    // thus - obey the limit (its a soft limit)
    const startTime = performance.now();

    for (let i = 0; i < items.length; i += 1) {
        const itemToRender = items[i];
        const requestFns = requestsForItem(itemToRender, settings, abort.signal);
        const cacheKey = (rq: string) => cacheKeyForRequest(rq, itemToRender, settings);
        const cacheKeys = Object.keys(requestFns).map(cacheKey);

        if (mutableCache.areKeysAllCached(cacheKeys)) {
            const result = mutableCache.cacheAndUse(requestFns, partial(render, itemToRender, settings), cacheKey);
            if (result !== undefined) {
                // this is a problem - the cache reported that all the keys are in the cache, however this result is a cancellation callback,
                // which indicates that the item could not be rendered right away, which should be impossible...
                // TODO
                taskCancelCallbacks.push(result);
            }
        } else {
            // areKeysAllCached returned false - enqueue for later
            queue.push(itemToRender);
        }
        if (performance.now() - startTime > queueTimeBudgetMS) {
            // we've used up all our time - enqueue all remaining tasks
            if (i < items.length - 1) {
                queue.push(...items.slice(i + 1));
            }
            break;
        }
    }

    if (queue.length === 0) {
        // we did all the work - it was already cached
        reportNormalStatus('finished_synchronously');
        return { cancelFrame: () => {} };
    }
    // TODO: Re-examine lifecycle reporting, potentially unify all statuses into a single type
    reportNormalStatus('begun');
    if (queue.length !== items.length) {
        // We did some work, but there's some left
        reportNormalStatus('progress');
    }
    const doWorkOnQueue = (intervalId: number) => {
        // try our best to cleanup if something goes awry
        const startWorkTime = performance.now();
        const cleanupOnError = (err: unknown) => {
            // clear the queue and the staging area (inFlight)
            for (const cancelMe of taskCancelCallbacks) {
                cancelMe();
            }
            queue.splice(0, queue.length);
            // stop fetching
            abort.abort(err);
            clearInterval(intervalId);
            // pass the error somewhere better:
            lifecycleCallback({ status: 'error', error: err });
        };
        while (mutableCache.getNumPendingTasks() < Math.max(maximumInflightAsyncTasks, 1)) {
            if (queue.length < 1) {
                // we cant add anything to the in-flight staging area, the final task
                // is already in flight
                if (mutableCache.getNumPendingTasks() < 1) {
                    // we do want to wait for that last in-flight task to actually finish though:
                    clearInterval(intervalId);
                    reportNormalStatus('finished');
                }
                return;
            }

            const itemToRender = queue.shift();
            if (itemToRender === undefined) {
                // This should logically never happen, but if it does something is wrong so we emit an error
                cleanupOnError(new Error('Internal error: itemToRender was undefined'));
                return;
            }

            const toCacheKey = (rq: string) => cacheKeyForRequest(rq, itemToRender, settings);
            try {
                const result = mutableCache.cacheAndUse(
                    requestsForItem(itemToRender, settings, abort.signal),
                    partial(render, itemToRender, settings),
                    toCacheKey,
                    () => reportNormalStatus('progress'),
                );
                if (result !== undefined) {
                    // put this cancel callback in a list where we can invoke if something goes wrong
                    // note that it is harmless to cancel a task that was completed
                    taskCancelCallbacks.push(result);
                }
            } catch (err) {
                cleanupOnError(err);
            }
            if (performance.now() - startWorkTime > queueTimeBudgetMS) {
                // used up all our time - leave remaining work for later
                break;
            }
        }
    };
    const interval = setInterval(() => doWorkOnQueue(interval), queueProcessingIntervalMS);

    // return a function to allow our caller to cancel the frame - guaranteed that no settings/data will be
    // touched/referenced after cancellation, unless the author of render() did some super weird bad things
    return {
        cancelFrame: (reason?: string) => {
            for (const cancelMe of taskCancelCallbacks) {
                cancelMe();
            }
            abort.abort(new DOMException(reason, 'AbortError'));
            clearInterval(interval);
            reportNormalStatus('cancelled');
        },
    };
}
