var fs = require('fs');
var path = require('path');

module.exports = function (config_filename, logger) {
	var helper = {};

	// default config file name
	if (!config_filename) {
		config_filename = 'marbles_tls.json';
	}

	var config_path = path.join(__dirname, '../config/' + config_filename);
	helper.config = require(config_path);
	var creds_path = path.join(__dirname, '../config/' + helper.config.cred_filename);
	helper.creds = require(creds_path);
	var packagejson = require(path.join(__dirname, '../package.json'));

	logger.info('Loaded config file', config_path);
	logger.info('Loaded creds file', creds_path);

	// get network id
	helper.getNetworkId = function () {
		return helper.creds['x-networkId'];
	};

	// get cred file name
	helper.getNetworkCredFileName = function () {
		return helper.config.cred_filename;
	};


	// --------------------------------------------------------------------------------
	// Peer Getters
	// --------------------------------------------------------------------------------
	// find the first ca in the peers field for this org
	helper.getFirstPeerName = function (ch) {
		const channel = helper.creds.channels[ch];
		if (channel && channel.peers) {
			const peers = Object.keys(channel.peers);
			if (peers && peers[0]) {
				return peers[0];
			}
		}
		throw new Error('Orderer not found for this channel', ch);
	};

	// get a peer object
	helper.getPeer = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Peer key not passed');
		}
		else {
			if (helper.creds.peers) {
				return helper.creds.peers[key];
			}
			else {
				return null;
			}
		}
	};

	// get a peer's grpc url
	helper.getPeersUrl = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Peer key not passed');
		}
		else {
			let peer = helper.getPeer(key);
			if (peer) {
				return peer.url;
			}
			else {
				throw new Error('Peer key not found.');
			}
		}
	};

	// get a peer's grpc event url
	helper.getPeerEventUrl = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Peer key not passed');
		} else {
			let peer = helper.getPeer(key);
			if (peer) {
				return peer.eventUrl;
			}
			else {
				throw new Error('Peer key not found.');
			}
		}
	};

	// get a peer's tls options
	helper.getPeerTLScertOpts = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Peer\'s key not passed');
		} else {
			let peer = helper.getPeer(key);
			return buildTlsOpts(peer);
		}
	};


	// --------------------------------------------------------------------------------
	// Certificate Authorities Getters
	// --------------------------------------------------------------------------------
	// find the first ca in the certificateAuthorities field for this org
	helper.getFirstCAname = function (orgName) {
		const org = helper.creds.organizations[orgName];
		if (org && org.certificateAuthorities) {
			if (org.certificateAuthorities && org.certificateAuthorities[0]) {
				return org.certificateAuthorities[0];
			}
		}
		throw new Error('CAs not found.');
	};

	// get a ca obj
	helper.getCA = function (key) {
		if (key === undefined || key == null) {
			throw new Error('CA key not passed');
		} else {
			if (helper.creds.certificateAuthorities) {
				return helper.creds.certificateAuthorities[key];
			} else {
				return null;
			}
		}
	};

	// get a ca's http url
	helper.getCasUrl = function (key) {
		if (key === undefined || key == null) {
			throw new Error('CA key not passed');
		} else {
			let ca = helper.getCA(key);
			if (ca) {
				return ca.url;
			}
			else {
				throw new Error('CA not found.');
			}
		}
	};

	// get a ca's name, could be null
	helper.getCaName = function (key) {
		if (key === undefined || key == null) {
			throw new Error('CA key not passed');
		} else {
			let ca = helper.getCA(key);
			if (ca) {
				return ca.caName;
			}
			else {
				throw new Error('CA not found.');
			}
		}
	};

	// get a ca's tls options
	helper.getCATLScertOpts = function (key) {
		if (key === undefined || key == null) {
			throw new Error('CAs key not passed');
		} else {
			let ca = helper.getCA(key);
			return buildTlsOpts(ca);
		}
	};

	// get an enrollment user
	helper.getEnrollObj = function (caKey, user_index) {
		if (caKey === undefined || caKey == null) {
			throw new Error('CA key not passed');
		} else {
			var ca = helper.getCA(caKey);
			if (ca && ca.registrar && ca.registrar[user_index]) {
				return ca.registrar[user_index];
			}
			else {
				throw new Error('Cannot find enroll id at index.', caKey, user_index);
			}
		}
	};

	// --------------------------------------------------------------------------------
	// Orderer Getters
	// --------------------------------------------------------------------------------
	// get the first orderer in the channels field
	helper.getFirstOrdererName = function (ch) {
		const channel = helper.creds.channels[ch];
		if (channel && channel.orderers && channel.orderers[0]) {
			return channel.orderers[0];
		}
		throw new Error('Orderer not found for this channel', ch);
	};

	// get an orderer object
	helper.getOrderer = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Orderers key not passed');
		} else {
			if (helper.creds.orderers) {
				return helper.creds.orderers[key];
			} else {
				return null;
			}
		}
	};

	// get an orderer's grpc url
	helper.getOrderersUrl = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Orderers key not passed');
		} else {
			let orderer = helper.getOrderer(key);
			if (orderer) {
				return orderer.url;
			}
			else {
				throw new Error('Orderer not found.');
			}
		}
	};

	// get a orderer's tls options
	helper.getOrdererTLScertOpts = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Orderer\'s key not passed');
		} else {
			let orderer = helper.getOrderer(key);
			return buildTlsOpts(orderer);
		}
	};


	// --------------------------------------------------------------------------------
	// Other Credential Getters
	// --------------------------------------------------------------------------------
	// build the tls options for the sdk
	function buildTlsOpts(node_obj) {
		let ret = {
			'ssl-target-name-override': null,
			pem: null
		};
		if (node_obj) {
			if (node_obj.tlsCACerts && node_obj.tlsCACerts.pem) {
				ret.pem = loadCert(node_obj.tlsCACerts.pem);
			} else if (node_obj.tlsCACerts && node_obj.tlsCACerts.path) {
				ret.pem = loadCert(node_obj.tlsCACerts.path);
			}
			if (node_obj.grpcOptions) {
				ret['ssl-target-name-override'] = node_obj.grpcOptions['ssl-target-name-override'];
			}
		}
		return ret;
	}

	// find the first org name in the organizaiton field
	helper.getFirstOrg = function () {
		if (helper.creds.organizations) {
			const orgs = Object.keys(helper.creds.organizations);
			if (orgs && orgs[0]) {
				return orgs[0];
			}
		}
		throw new Error('Orgs not found.');
	};

	// get this org's msp id
	helper.getOrgsMSPid = function (key) {
		if (key === undefined || key == null) {
			throw new Error('Org key not passed');
		}
		else {
			if (helper.creds.organizations && helper.creds.organizations[key]) {
				return helper.creds.organizations[key].mspid;
			}
			else {
				throw new Error('Org key not found.', key);
			}
		}
	};

	// get an admin private key PEM certificate
	helper.getAdminPrivateKeyPEM = function (orgName) {
		if (orgName && helper.creds.organizations && helper.creds.organizations[orgName]) {
			return loadKey(helper.creds.organizations[orgName].adminPrivateKeyPEM);
		}
		else {
			throw new Error('Cannot find org.', orgName);
		}
	};

	// get an admin's signed cert PEM
	helper.getAdminSignedCertPEM = function (orgName) {
		if (orgName && helper.creds.organizations && helper.creds.organizations[orgName]) {
			return loadKey(helper.creds.organizations[orgName].signedCertPEM);
		}
		else {
			throw new Error('Cannot find org.', orgName);
		}
		return null;
	};

	// load cert from file path OR just pass cert back
	function loadCert(value) {
		if (value && value.indexOf('-BEGIN CERTIFICATE-') === -1) {		// looks like cert field is a path to a file
			var path2cert = path.join(__dirname, '../config/' + value);
			return fs.readFileSync(path2cert, 'utf8') + '\r\n'; 		//read from file, LOOKING IN config FOLDER
		} else {
			return value;												//can be null if network is not using TLS
		}
	}

	// load cert from file path OR just pass cert back
	function loadKey(value) {
		if (value && value.indexOf('-BEGIN PRIVATE KEY-') === -1) {		// looks like private key field is a path to a file
			var path2cert = path.join(__dirname, '../config/' + value);
			return fs.readFileSync(path2cert, 'utf8') + '\r\n'; 		//read from file, LOOKING IN config FOLDER
		} else {
			return value;												//can be null if network is not using TLS
		}
	}

	// get the channel id on network for marbles
	helper.getChannelId = function () {
		if (helper.creds && helper.creds.channels) {
			var channels = Object.keys(helper.creds.channels);
			if (channels[0]) {
				return channels[0];
			}
		}
		throw Error('No channels found in credentials file...');
	};

	// get the chaincode id on network
	helper.getChaincodeId = function () {
		var channel = helper.getChannelId();
		var chaincode = Object.keys(helper.creds.channels[channel].chaincodes);
		return chaincode[0];
	};

	// get the chaincode version on network
	helper.getChaincodeVersion = function () {
		var channel = helper.getChannelId();
		var chaincode = Object.keys(helper.creds.channels[channel].chaincodes);
		return helper.creds.channels[channel].chaincodes[chaincode];
	};

	// get the chaincode id on network
	helper.getBlockDelay = function () {
		//var ret = getBlockchainField('block_delay');
		//if (!ret || isNaN(ret)) 
		var ret = 10000;
		return ret;
	};


	// --------------------------------------------------------------------------------
	// Config Getters
	// --------------------------------------------------------------------------------
	// get the marble owner names
	helper.getMarbleUsernames = function () {
		return getMarblesField('usernames');
	};

	// get the marbles trading company name
	helper.getCompanyName = function () {
		return getMarblesField('company');
	};

	// get the marble's server port number
	helper.getMarblesPort = function () {
		return getMarblesField('port');
	};

	// get the status of marbles previous startup
	helper.getEventsSetting = function () {
		if (helper.config['use_events']) {
			return helper.config['use_events'];
		}
		return false;
	};

	// get the re-enrollment period in seconds
	helper.getKeepAliveMs = function () {
		var sec = getMarblesField('keep_alive_secs');
		if (!sec) sec = 30;									//default to 30 seconds
		return (sec * 1000);
	};

	// safely retrieve marbles fields
	function getMarblesField(marbles_field) {
		try {
			if (helper.config[marbles_field]) {
				return helper.config[marbles_field];
			}
			else {
				logger.warn('"' + marbles_field + '" not found in config json: ' + config_path);
				return null;
			}
		}
		catch (e) {
			logger.warn('"' + marbles_field + '" not found in config json: ' + config_path);
			return null;
		}
	}


	// --------------------------------------------------------------------------------
	// Build Options
	// --------------------------------------------------------------------------------
	// build the marbles lib module options
	helper.makeMarblesLibOptions = function () {
		const channel = helper.getChannelId();
		const first_org = helper.getFirstOrg();
		const first_ca = helper.getFirstCAname(first_org);
		const first_peer = helper.getFirstPeerName(channel);
		const first_orderer = helper.getFirstOrdererName(channel);
		return {
			block_delay: helper.getBlockDelay(),
			channel_id: helper.getChannelId(),
			chaincode_id: helper.getChaincodeId(),
			event_url: (helper.getEventsSetting()) ? helper.getPeerEventUrl(first_peer) : null,
			chaincode_version: helper.getChaincodeVersion(),
			ca_tls_opts: helper.getCATLScertOpts(first_ca),
			orderer_tls_opts: helper.getOrdererTLScertOpts(first_orderer),
			peer_tls_opts: helper.getPeerTLScertOpts(first_peer),
		};
	};

	// build the enrollment options for using an enroll ID
	helper.makeEnrollmentOptions = function (userIndex) {
		if (userIndex === undefined || userIndex == null) {
			throw new Error('User index not passed');
		} else {
			const channel = helper.getChannelId();
			const first_org = helper.getFirstOrg();
			const first_ca = helper.getFirstCAname(first_org);
			const first_peer = helper.getFirstPeerName(channel);
			const first_orderer = helper.getFirstOrdererName(channel);
			const org_name = helper.getOrgsMSPid(first_org);				//lets use the first org we find
			const user_obj = helper.getEnrollObj(first_ca, userIndex);		//there may be multiple users
			return {
				channel_id: channel,
				uuid: 'marbles-' + helper.getNetworkId() + '-' + channel + '-' + first_peer,
				ca_url: helper.getCasUrl(first_ca),
				ca_name: helper.getCaName(first_ca),
				orderer_url: helper.getOrderersUrl(first_orderer),
				peer_urls: [helper.getPeersUrl(first_peer)],
				enroll_id: user_obj.enrollId,
				enroll_secret: user_obj.enrollSecret,
				msp_id: org_name,
				ca_tls_opts: helper.getCATLScertOpts(first_ca),
				orderer_tls_opts: helper.getOrdererTLScertOpts(first_orderer),
				peer_tls_opts: helper.getPeerTLScertOpts(first_peer),
			};
		}
	};

	// build the enrollment options using an admin cert
	helper.makeEnrollmentOptionsUsingCert = function () {
		const channel = helper.getChannelId();
		const first_org = helper.getFirstOrg();
		const first_peer = helper.getFirstPeerName(channel);
		const first_orderer = helper.getFirstOrdererName(channel);		
		const org_name = helper.getOrgsMSPid(first_org);		//lets use the first org we find
		return {
			channel_id: channel,
			uuid: 'marbles-' + helper.getNetworkId() + '-' + channel + '-' + first_peer,
			orderer_url: helper.getOrderersUrl(first_orderer),
			peer_urls: [helper.getPeersUrl(first_peer)],
			msp_id: org_name,
			privateKeyPEM: helper.getAdminPrivateKeyPEM(org_name),
			signedCertPEM: helper.getAdminSignedCertPEM(org_name),
			orderer_tls_opts: helper.getOrdererTLScertOpts(first_orderer),
			peer_tls_opts: helper.getPeerTLScertOpts(first_peer),
		};
	};

	// write new settings
	helper.write = function (obj) {
		/*
		var config_file = JSON.parse(fs.readFileSync(config_path, 'utf8'));
		var creds_file = JSON.parse(fs.readFileSync(creds_path, 'utf8'));
	
		if (obj.ordererUrl) {
			creds_file.credentials.orderers[0].discovery_url = obj.ordererUrl;
		}
		if (obj.peerUrl) {
			creds_file.credentials.peers[0].discovery_url = obj.peerUrl;
		}
		if (obj.caUrl) {
			creds_file.credentials.cas[0].api_url = obj.caUrl;
		}
		if (obj.chaincodeId) {
			creds_file.credentials.app.chaincode_id = obj.chaincodeId;
		}
		if (obj.chaincodeVersion) {
			creds_file.credentials.app.chaincode_version = obj.chaincodeVersion;
		}
		if (obj.channelId) {
			creds_file.credentials.app.channel_id = obj.channelId;
		}
		if (obj.enrollId && obj.enrollSecret) {
			for (let i in creds_file.credentials.cas[0].orgs) {
				creds_file.credentials.cas[0].orgs[i].users[0] = {
					enrollId: obj.enrollId,
					enrollSecret: obj.enrollSecret
				};
			}
		}
	
		fs.writeFileSync(creds_path, JSON.stringify(creds_file, null, 4), 'utf8');	//save to file
		helper.creds = creds_file;													//replace old copy
		fs.writeFileSync(config_path, JSON.stringify(config_file, null, 4), 'utf8');//save to file
		helper.config = config_file;												//replace old copy
		*/
	};


	// --------------------------------------------------------------------------------
	// Input Checking
	// --------------------------------------------------------------------------------
	// check if user has changed the settings from the default ones - returns error array when there is a problem
	helper.checkConfig = function () {
		let errors = [];
		if (helper.getNetworkId() === 'Place Holder Network Name') {
			console.log('\n');
			logger.warn('----------------------------------------------------------------------');
			logger.warn('----------------------------- Hey Buddy! -----------------------------');
			logger.warn('------------------------- It looks like you --------------------------');
			logger.error('----------------------------- skipped -------------------------------');
			logger.warn('------------------------- some instructions --------------------------');
			logger.warn('----------------------------------------------------------------------');
			logger.warn('Your network config JSON has a network ID of "Place Holder Network Name"...');
			logger.warn('I\'m afraid you cannot use the default settings as is.');
			logger.warn('These settings must be edited to point to YOUR network.');
			logger.warn('----------------------------------------------------------------------');
			logger.error('Fix this file: ./config/' + helper.getNetworkCredFileName());
			logger.warn('It must have credentials/hostnames/ports/channels/etc for YOUR network');
			logger.warn('How/where would I get that info? Are you using the Bluemix service? Then look at these instructions(near the end): ');
			logger.warn('https://github.com/IBM-Blockchain/marbles/blob/experimental/docs/install_chaincode.md');
			logger.warn('----------------------------------------------------------------------');
			console.log('\n\n');
			errors.push('Using default values');
			return errors;
		}
		return helper.check_for_missing();					//run the next check
	};

	// check if marbles UI and marbles chaincode work together
	helper.errorWithVersions = function (v) {
		var version = packagejson.version;
		if (!v || !v.parsed) v = { parsed: '0.x.x' };		//default
		if (v.parsed[0] !== version[0]) {					//only check the major version
			console.log('\n');
			logger.warn('---------------------------------------------------------------');
			logger.warn('----------------------------- Ah! -----------------------------');
			logger.warn('---------------------------------------------------------------');
			logger.error('Looks like you are using an old version of marbles chaincode...');
			logger.warn('The INTERNAL version of the chaincode found is: v' + v.parsed);
			logger.warn('But this UI is expecting INTERNAL chaincode version: v' + version[0] + '.x.x');
			logger.warn('This mismatch won\'t work =(');
			logger.warn('Install and instantiate the chaincode found in the ./chaincode folder on your channel ' + helper.getChannelId());
			logger.warn('----------------------------------------------------------------------');
			console.log('\n\n');
			return true;
		}
		return false;
	};

	// check if config has missing entries
	helper.check_for_missing = function () {
		let errors = [];
		const channel = helper.getChannelId();

		if (!channel) {
			errors.push('There is no channel data in the "channels" field');
		} else {
			const first_org = helper.getFirstOrg();
			const first_ca = helper.getFirstCAname(first_org);
			const first_orderer = helper.getFirstOrdererName(channel);
			const first_peer = helper.getFirstPeerName(channel);

			if (!helper.getCA(first_ca)) {
				errors.push('There is no CA data in the "certificateAuthorities" field');
			}
			if (!helper.getOrderer(first_orderer)) {
				errors.push('There is no Orderer data in the "orderers" field');
			}
			if (!helper.getPeer(first_peer)) {
				errors.push('There is no Peer data in the "peers" field');
			}
		}

		if (errors.length > 0) {
			console.log('\n');
			logger.warn('----------------------------------------------------------------------');
			logger.warn('------------------------------- Whoops -------------------------------');
			logger.warn('----------- You are missing some data in your creds file -------------');
			logger.warn('----------------------------------------------------------------------');
			for (var i in errors) {
				logger.error(errors[i]);
			}
			logger.warn('----------------------------------------------------------------------');
			logger.error('Fix this file: ./config/' + helper.getNetworkCredFileName());
			logger.warn('----------------------------------------------------------------------');
			logger.warn('See this file for help:');
			logger.warn('https://github.com/IBM-Blockchain/marbles/blob/experimental/docs/config_file.md');
			logger.warn('----------------------------------------------------------------------');
			console.log('\n\n');
			return errors;
		}
		return helper.check_protocols();					//run the next check
	};

	// check if config has protocol errors - returns error array when there is a problem
	helper.check_protocols = function () {
		let errors = [];
		const channel = helper.getChannelId();
		const first_org = helper.getFirstOrg();
		const first_ca = helper.getFirstCAname(first_org);
		const first_orderer = helper.getFirstOrdererName(channel);
		const first_peer = helper.getFirstPeerName(channel);

		if (helper.getCasUrl(first_ca).indexOf('grpc') >= 0) {
			errors.push('You accidentally typed "grpc" in your CA url. It should be "http://" or "https://"');
		}
		if (helper.getOrderersUrl(first_orderer).indexOf('http') >= 0) {
			errors.push('You accidentally typed "http" in your Orderer url. It should be "grpc://" or "grpcs://"');
		}
		if (helper.getPeersUrl(first_peer).indexOf('http') >= 0) {
			errors.push('You accidentally typed "http" in your Peer discovery url. It should be "grpc://" or "grpcs://"');
		}
		if (helper.getPeerEventUrl(first_peer).indexOf('http') >= 0) {
			errors.push('You accidentally typed "http" in your Peer events url. It should be "grpc://" or "grpcs://"');
		}

		if (errors.length > 0) {
			console.log('\n');
			logger.warn('----------------------------------------------------------------------');
			logger.warn('------------------------ Close but no cigar --------------------------');
			logger.warn('---------------- You have at least one protocol typo -----------------');
			logger.warn('----------------------------------------------------------------------');
			for (var i in errors) {
				logger.error(errors[i]);
			}
			logger.warn('----------------------------------------------------------------------');
			logger.error('Fix this file: ./config/' + helper.getNetworkCredFileName());
			logger.warn('----------------------------------------------------------------------');
			logger.warn('See this file for help:');
			logger.warn('https://github.com/IBM-Blockchain/marbles/blob/experimental/docs/config_file.md');
			logger.warn('----------------------------------------------------------------------');
			console.log('\n\n');
			return errors;
		}
		return null;
	};

	return helper;
};
