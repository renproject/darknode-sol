export function TestHelper(txParams: any, networkFile: any): any;
export const commands: {
    add: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    bump: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    check: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    create: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    freeze: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    init: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    link: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    publish: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    push: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
        tryAction: Function;
    };
    remove: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    session: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    setAdmin: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    status: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    unlink: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    update: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
    verify: {
        action: Function;
        description: string;
        name: string;
        register: Function;
        signature: string;
    };
};
export namespace files {
    class ZosNetworkFile {
        constructor(packageFile: any, network: any, fileName: any);
        packageFile: any;
        network: any;
        fileName: any;
        data: any;
        addContract(alias: any, instance: any, { warnings, types, storage }: any): void;
        addProxy(thepackage: any, alias: any, info: any): void;
        addSolidityLib(libName: any, instance: any): void;
        contract(alias: any): any;
        contractAliasesMissingFromPackage(): any;
        dependenciesNamesMissingFromPackage(): any;
        dependencyHasCustomDeploy(name: any): any;
        dependencyHasMatchingCustomDeploy(name: any): any;
        dependencySatisfiesVersionRequirement(name: any): any;
        getDependency(name: any): any;
        getProxies({ package: packageName, contract, address }: any): any;
        getProxy(address: any): any;
        getSolidityLibOrContract(aliasOrName: any): any;
        getSolidityLibs(libs: any): any;
        hasContract(alias: any): any;
        hasContracts(): any;
        hasDependencies(): any;
        hasDependency(name: any): any;
        hasMatchingVersion(): any;
        hasProxies(filter: any): any;
        hasSameBytecode(alias: any, klass: any): any;
        hasSolidityLib(libName: any): any;
        hasSolidityLibOrContract(aliasOrName: any): any;
        isCurrentVersion(version: any): any;
        removeProxy(thepackage: any, alias: any, address: any): void;
        setContract(alias: any, value: any): void;
        setDependency(name: any, { package: thepackage, version, customDeploy }: any): void;
        setProxies(packageName: any, alias: any, value: any): void;
        setSolidityLib(alias: any, value: any): void;
        solidityLib(libName: any): any;
        solidityLibsMissing(libs: any): any;
        unsetContract(alias: any): void;
        unsetDependency(name: any): void;
        unsetSolidityLib(libName: any): void;
        updateDependency(name: any, fn: any): void;
        updateImplementation(aliasOrName: any, fn: any): void;
        updateProxy({ package: proxyPackageName, contract: proxyContractName, address: proxyAddress }: any, fn: any): void;
        write(): void;
    }
    class ZosPackageFile {
        constructor(fileName: any);
        fileName: any;
        data: any;
        addContract(alias: any, name: any): void;
        contract(alias: any): any;
        dependencyMatches(name: any, version: any): any;
        exists(): any;
        getDependencyVersion(name: any): any;
        hasContract(alias: any): any;
        hasContracts(): any;
        hasDependencies(): any;
        hasDependency(name: any): any;
        hasName(name: any): any;
        isCurrentVersion(version: any): any;
        networkFile(network: any): any;
        setDependency(name: any, version: any): void;
        unsetContract(alias: any): void;
        unsetDependency(name: any): void;
        write(): void;
    }
    const ZosVersion: any;
}
export namespace local {
    function ControllerFor(packageFile: any): any;
    class LocalAppController {
        add(contractAlias: any, contractName: any): void;
        addAll(): void;
        bumpVersion(version: any): void;
        checkCanAdd(contractName: any): void;
        getContractClass(packageName: any, contractAlias: any): any;
        getContractSourcePath(contractAlias: any): any;
        hasBytecode(contractDataPath: any): any;
        init(name: any, version: any, force: any, publish: any): void;
        initZosPackageFile(name: any, version: any, force: any): void;
        linkLibs(libs: any, installLibs: any): void;
        onNetwork(network: any, txParams: any, networkFile: any): any;
        remove(contractAlias: any): void;
        unlinkLibs(libNames: any): void;
        validate(contractAlias: any, buildArtifacts: any): any;
        validateAll(): any;
        writePackage(): void;
    }
    class LocalBaseController {
        constructor(packageFile: any);
        packageFile: any;
        add(contractAlias: any, contractName: any): void;
        addAll(): void;
        bumpVersion(version: any): void;
        checkCanAdd(contractName: any): void;
        getContractClass(packageName: any, contractAlias: any): any;
        getContractSourcePath(contractAlias: any): any;
        hasBytecode(contractDataPath: any): any;
        init(name: any, version: any, force: any): void;
        initZosPackageFile(name: any, version: any, force: any): void;
        remove(contractAlias: any): void;
        validate(contractAlias: any, buildArtifacts: any): any;
        validateAll(): any;
        writePackage(): void;
    }
    class LocalLibController {
        add(contractAlias: any, contractName: any): void;
        addAll(): void;
        bumpVersion(version: any): void;
        checkCanAdd(contractName: any): void;
        getContractClass(packageName: any, contractAlias: any): any;
        getContractSourcePath(contractAlias: any): any;
        hasBytecode(contractDataPath: any): any;
        init(name: any, version: any, force: any): void;
        initZosPackageFile(name: any, version: any, force: any): void;
        onNetwork(network: any, txParams: any, networkFile: any): any;
        remove(contractAlias: any): void;
        validate(contractAlias: any, buildArtifacts: any): any;
        validateAll(): any;
        writePackage(): void;
    }
}
export const naming: any;
export namespace network {
    function ControllerFor(network: any, txParams: any, networkFile: any): any;
    class NetworkAppController {
        checkContractDeployed(packageName: any, contractAlias: any, throwIfFail: any): void;
        checkInitialization(contractClass: any, calledInitMethod: any, calledInitArgs: any): void;
        checkLocalContractDeployed(contractAlias: any, throwIfFail: any): void;
        checkLocalContractsDeployed(throwIfFail: any): void;
        checkNotFrozen(): void;
        compareCurrentStatus(): void;
        createProxy(packageName: any, contractAlias: any, initMethod: any, initArgs: any): any;
        deployLibIfNeeded(depName: any, depVersion: any): void;
        deployLibs(): void;
        fetchOrDeploy(requestedVersion: any): any;
        freeze(): void;
        getDeployer(requestedVersion: any): any;
        handleLibsLink(): void;
        hasContractChanged(contractAlias: any, contractClass: any): any;
        isContractDefined(contractAlias: any): any;
        isContractDeployed(contractAlias: any): any;
        isLocalContract(contractAlias: any): any;
        linkLib(depName: any, depVersion: any): any;
        newVersion(versionName: any): any;
        pullRemoteStatus(): void;
        push(reupload: any, force: any): void;
        setProxiesAdmin(packageName: any, contractAlias: any, proxyAddress: any, newAdmin: any): any;
        toFullApp(): void;
        unlinkLib(depName: any): void;
        unsetContract(contractAlias: any): void;
        unsetContracts(): void;
        upgradeProxies(packageName: any, contractAlias: any, proxyAddress: any, initMethod: any, initArgs: any): any;
        uploadContract(contractAlias: any, contractClass: any): void;
        uploadContracts(contracts: any): void;
        uploadSolidityLibs(libs: any): void;
        validateContract(contractAlias: any, contractClass: any, buildArtifacts: any): any;
        validateContracts(contracts: any, buildArtifacts: any): any;
        verifyAndPublishContract(contractAlias: any, optimizer: any, optimizerRuns: any, remote: any): void;
        writeNetworkPackageIfNeeded(): void;
    }
    class NetworkBaseController {
        constructor(localController: any, network: any, txParams: any, networkFile: any);
        localController: any;
        txParams: any;
        network: any;
        networkFile: any;
        checkContractDeployed(packageName: any, contractAlias: any, throwIfFail: any): void;
        checkLocalContractDeployed(contractAlias: any, throwIfFail: any): void;
        checkLocalContractsDeployed(throwIfFail: any): void;
        checkNotFrozen(): void;
        compareCurrentStatus(): void;
        createProxy(): void;
        fetchOrDeploy(requestedVersion: any): any;
        freeze(): void;
        getDeployer(): void;
        handleLibsLink(): void;
        hasContractChanged(contractAlias: any, contractClass: any): any;
        isContractDefined(contractAlias: any): any;
        isContractDeployed(contractAlias: any): any;
        isLocalContract(contractAlias: any): any;
        newVersion(versionName: any): any;
        pullRemoteStatus(): void;
        push(reupload: any, force: any): void;
        unsetContract(contractAlias: any): void;
        unsetContracts(): void;
        uploadContract(contractAlias: any, contractClass: any): void;
        uploadContracts(contracts: any): void;
        uploadSolidityLibs(libs: any): void;
        validateContract(contractAlias: any, contractClass: any, buildArtifacts: any): any;
        validateContracts(contracts: any, buildArtifacts: any): any;
        verifyAndPublishContract(contractAlias: any, optimizer: any, optimizerRuns: any, remote: any): void;
        writeNetworkPackageIfNeeded(): void;
    }
    class NetworkLibController {
        checkContractDeployed(packageName: any, contractAlias: any, throwIfFail: any): void;
        checkLocalContractDeployed(contractAlias: any, throwIfFail: any): void;
        checkLocalContractsDeployed(throwIfFail: any): void;
        checkNotFrozen(): void;
        compareCurrentStatus(): void;
        createProxy(): void;
        fetchOrDeploy(requestedVersion: any): any;
        freeze(): void;
        getDeployer(requestedVersion: any): any;
        handleLibsLink(): void;
        hasContractChanged(contractAlias: any, contractClass: any): any;
        isContractDefined(contractAlias: any): any;
        isContractDeployed(contractAlias: any): any;
        isLocalContract(contractAlias: any): any;
        newVersion(versionName: any): any;
        pullRemoteStatus(): void;
        push(reupload: any, force: any): void;
        unsetContract(contractAlias: any): void;
        unsetContracts(): void;
        uploadContract(contractAlias: any, contractClass: any): void;
        uploadContracts(contracts: any): void;
        uploadSolidityLibs(libs: any): void;
        validateContract(contractAlias: any, contractClass: any, buildArtifacts: any): any;
        validateContracts(contracts: any, buildArtifacts: any): any;
        verifyAndPublishContract(contractAlias: any, optimizer: any, optimizerRuns: any, remote: any): void;
        writeNetworkPackageIfNeeded(): void;
    }
}
export function runWithTruffle(script: any, options: any): void;
export namespace scripts {
    function add({ contractsData, packageFile/* = undefined*/ }: any): void;
    function addAll({ packageFile/* = undefined*/ }: any): void;
    function bump({ version, packageFile/* = undefined*/ }: any): void;
    function compare({ network, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function create({ packageName, contractAlias, initMethod, initArgs, network, txParams/* = {}*/, force/* = false*/, networkFile/* = undefined*/ }: any): any;
    function freeze({ network, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function init({ name, version, publish/* = false*/, libs/* = []*/, installLibs/* = false*/, force/* = false*/, packageFile/* = new _ZosPackageFile2.default()*/ }: any): void;
    function initLib({ name, version, force/* = false*/, packageFile/* = new _ZosPackageFile2.default()*/ }: any): void;
    function link({ libs/* = []*/, installLibs/* = false*/, packageFile/* = undefined*/ }: any): void;
    function publish({ network, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function pull({ network, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function push({ network, deployLibs, reupload/* = false*/, force/* = false*/, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function remove({ contracts, packageFile/* = undefined*/ }: any): void;
    function session({ network, from, timeout, close/* = false*/, expires }: any): void;
    function setAdmin({ newAdmin, packageName, contractAlias, proxyAddress, network, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function status({ network, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function unlink({ libNames/* = []*/, packageFile/* = undefined*/ }: any): void;
    function update({ packageName, contractAlias, proxyAddress, initMethod, initArgs, all, network, force/* = false*/, txParams/* = {}*/, networkFile/* = undefined*/ }: any): void;
    function verify(contractAlias: any, { network/* = 'mainnet'*/, txParams/* = {}*/, networkFile/* = undefined*/, optimizer/* = false*/, optimizerRuns/* = 200*/, remote/* = 'etherchain'*/ }: any): void;
}
export namespace stdout {
    function log(...args: any[]): void;
    function silent(value: any): void;
}
export const version: string;