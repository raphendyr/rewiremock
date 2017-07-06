import Module from 'module';
import wipeCache from './wipeCache';
import createScope from './scope';
import {setScope} from './globals';
import executor, {originalLoader} from './executor';
import {
    convertName,
    onMockCreate,
    onDisable,
    addPlugin as addPluginAPI,
    removePlugin as removePluginAPI
} from './plugins';
import {resetMock, getMock, getAllMocks} from './mocks';
import ModuleMock from './mock';

let parentModule = module.parent;
let mockScope = null;
const scope = () => setScope(mockScope);
const updateScope = (parentScope = null) => {
    mockScope = createScope(parentScope, parentModule);
    scope();
};

updateScope();

/** main **/

/**
 * @name rewiremock
 * @param {String} module name
 * @return {ModuleMock}
 */
function mockModule(moduleName) {
    scope();
    const name = convertName(moduleName, parentModule);
    resetMock(name);
    return onMockCreate(new ModuleMock(getMock(name)));
}

/**
 * @name rewiremock.resolve
 * @param {String} module name
 * @return {String} converted module name
 */
mockModule.resolve = (module) => {
    scope();
    return convertName(module, parentModule);
};

/** flags **/

/**
 * Activates module isolation
 */
mockModule.isolation = () => {
    mockScope.isolation = true;
};

/**
 * Deactivates isolation
 */
mockModule.withoutIsolation = () => {
    mockScope.isolation = false;
};

/**
 * Adding new passby record
 * @param {String|RegEx|Function} pattern
 */
mockModule.passBy = (pattern) => {
    mockScope.passBy.push(pattern);
};

mockModule.overrideEntryPoint = (parent) => {
    mockScope.parentModule = parentModule = parent || module.parent.parent;
};


/** interface **/

/**
 * enabled rewiremock
 */
mockModule.enable = () => {
    scope();
    Module._load = executor;
    wipeCache();
};

/**
 * disabled rewiremock
 */
mockModule.disable = () => {
    scope();
    Module._load = originalLoader;
    onDisable(getAllMocks());
    mockModule.withoutIsolation();
    mockModule.flush();
};

/**
 * Creates temporary executing scope. All mocks and plugins you will add in callback will be removed at exit.
 * @param callback
 */
mockModule.inScope = (callback) => {
    const currentScope = mockScope;
    updateScope(currentScope);
    callback();
    mockScope = currentScope;
};

/**
 * executes module in sandbox
 * @param {Function} loader loader callback
 * @param {Function} [createCallback] - optional callback to be executed before load.
 * @return {Promise}
 */
mockModule.around = (loader, createCallback) => {
    return new Promise((resolve, reject) => {
        const currentScope = mockScope;
        updateScope(currentScope);

        Promise.resolve(createCallback && createCallback(mockModule))
            .then(() => mockModule.enable())
            .then(() =>
                Promise.resolve(loader()).then((mockedResult) => {
                    mockModule.disable();
                    mockScope = currentScope;
                    resolve(mockedResult);
                }, (err) => reject(err))
            );
    });
};

/**
 * flushes all active overrides
 */
mockModule.flush = () => {
    wipeCache(mockScope.mockedModules);
    mockScope.mockedModules = {};
};

/**
 * flushes anything
 */
mockModule.clear = () => {
    updateScope();
    scope();
    mockModule.withoutIsolation();
    mockModule.flush();
};

const cleanup = () => {
    delete require.cache[require.resolve(__filename)];
};


const addPlugin = (plugin) => {
    scope();
    addPluginAPI(plugin);
};

const removePlugin = (plugin) => {
    scope();
    removePluginAPI(plugin);
};

export {
    mockModule,
    addPlugin,
    removePlugin,
    cleanup
};
