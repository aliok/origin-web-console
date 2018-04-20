'use strict';


angular.module('openshiftConsole').component('mobileClientConfig', {
    bindings: {
      mobileClient: '<',
      projectName: '<'
    },
    templateUrl: 'views/mobile-client-config.html',
    controller: [
      'APIService',
      'DataService',
      'API_CFG',
      MobileClientConfigCtrl]
  });

var filterExcludedServices = function(serviceInstances, mobileClient) {
  return _.filter(serviceInstances, function(service, serviceName){
    return _.indexOf(_.get(mobileClient, 'spec.excludedServices'), serviceName) === -1;
  });
};

var getServiceConfig = function(configmaps, services) {
  return _(configmaps.by('metadata.name'))
  .filter(function(configmap) {
    return  _.findIndex(services, {metadata: {labels: {serviceName: _.get(configmap, 'metadata.name')}}}) !== -1;
  })
  .map(function(configmap) {
    if(configmap.data && configmap.data.type === "keycloak"){
      return {
        id: "keycloak",
        name: "keycloak",
        type: configmap.data.type,
        url: configmap.data.uri,
        config: JSON.parse(configmap.data.public_installation)
      };
    } else if(configmap.data && configmap.data.type === "Custom Runtime Connector"){
      return {
        id: _.get(configmap, 'metadata.name'),
        name: configmap.data.name,
        type: configmap.data.type,
        url: configmap.data.uri,
        config: JSON.parse(configmap.data.config)
      };
    } else {
      return {
        id: _.get(configmap, 'metadata.name'),
        name: _.get(configmap, 'metadata.name'),
        type: configmap.data.type,
        url: configmap.data.uri,
        config: configmap.data
      };
    }
  }).value();
};

var getClientConfig = function(mobileClient, serviceConfig, clusterInfo) {
  return JSON.stringify({
    version: 1,
    clusterName: clusterInfo.openshift.hostPort,
    namespace: _.get(mobileClient, 'metadata.namespace'),
    clientId: _.get(mobileClient, 'metadata.name'),
    services: serviceConfig
  }, null, '  ');
};

function MobileClientConfigCtrl(APIService, DataService, API_CFG) {
  var ctrl = this;
  var watches = [];
  ctrl.$onInit = function(){
    var context = {namespace: ctrl.projectName};
    //keep list of active services upto date
    watches.push(DataService.watch(
      APIService.getPreferredVersion('serviceinstances'),
      context,
      function (serviceinstances){
        ctrl.services = serviceinstances.by('metadata.name');
        DataService.list(APIService.getPreferredVersion('configmaps'), context, updateClientConfig, {errorNotification: false});
      },
      { errorNotification: false }
    ));
    watches.push(DataService.watch(APIService.getPreferredVersion('configmaps'), context, updateClientConfig, {errorNotification: false}));

    // update the config string by pulling out configmaps that match ctrl.services
    function updateClientConfig(configmaps){
      ctrl.configmaps = configmaps;
      var services = filterExcludedServices(ctrl.services, ctrl.mobileClient);
      ctrl.serviceConfig = getServiceConfig(configmaps, services);
      ctrl.prettyConfig = getClientConfig(ctrl.mobileClient, ctrl.serviceConfig, API_CFG);
    }
  };

  ctrl.$onChanges = function(changes) {
    if (changes.mobileClient && ctrl.configmaps && ctrl.services) {
      var services = filterExcludedServices(ctrl.services, ctrl.mobileClient);
      ctrl.serviceConfig = getServiceConfig(ctrl.configmaps, services);
      ctrl.prettyConfig = getClientConfig(ctrl.mobileClient, ctrl.serviceConfig, API_CFG);
    }
  };

  ctrl.$onDestroy = function() {
    DataService.unwatchAll(watches);
  };
}
