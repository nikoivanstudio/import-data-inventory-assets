import { AbstractRecord, backendPropertyManager, Dialog, UserManager } from '@universe-platform/sdk'
import {
  CardStore,
  IMetaModel,
  IMetaAbstractAttribute,
  MetaTypeGuards,
  NamespaceManager,
  RouterStore,
} from '@universe-platform/sdk'

import { reaction, runInAction } from 'mobx'

type RecordStoreCtor = new (
  routerStore: RouterStore,
  namespaceId: UniverseNamespace.NamespaceId,
  typeName: string,
  etalonId: string | undefined,
  ueTabs?: string[]
) => {
  fetchMeta(namespace: UniverseNamespace.NamespaceId, typeName: string): Promise<IMetaModel>
} & Partial<CardStore<any>>

export declare enum AttributeTypeCategory {
  simpleDataType = 'simpleDataType',
  enumDataType = 'enumDataType',
  lookupEntityType = 'lookupEntityType',
  linkDataType = 'linkDataType',
  arrayDataType = 'arrayDataType',
  dictionaryDataType = 'dictionaryDataType',
}

const STATUS_ATTRIBUTE_CODE_NAME = 'STATUS'
const STATUS_ATTRIBUTE_ARCHIVE_VALUE = 'ARCHIVE'
const READONLY_ROLES_BACKEND_PROPERTY_NAME = 'com.disgroup.mdm.integration.notification.enrich.messaging.roles'
const READONLY_ROLES_BACKEND_PROPERTY_DELIMITER = '|'
const SHOULD_UPDATE_CUSTOM_PROPERTY_NAME = 'SHOULD_UPDATE'

const getBackendProperty = async (key: string) => {
  if (backendPropertyManager['needLoad']) {
    await backendPropertyManager.reload()
  }

  return backendPropertyManager.getItem(key)?.value.getValue()
}

console.log('ForceHiddenMeta')

NamespaceManager.recordNamespaceIds.forEach((namespaceId: string) => {
  const DataCardStore = NamespaceManager['recordStoreCtorMapping'][namespaceId]

  class SomeCustomDataCardStore extends DataCardStore {
    constructor(
      routerStore: RouterStore,
      namespaceId: UniverseNamespace.NamespaceId,
      typeName: string,
      etalonId: string | undefined,
      ueTabs?: string[]
    ) {
      super(routerStore, namespaceId, typeName, etalonId, ueTabs)

      this.initPromise.then(() => {
        reaction(
          () => this.draftStore.currentDraft,
          () => {
            if (!this.draftStore || !this.draftStore.currentDraft) {
              return
            }

            if (this.draftStore.currentDraft.state.getValue() !== 'CREATED') {
              return
            }

            const displayTimelineWindowCustomParam = this.metaRecordStore
              .getMetaEntity()
              .customProperties.find((prop: any) => prop.name.getValue() === 'DISPLAY_TIMELINE_WINDOW')

            if (displayTimelineWindowCustomParam?.value.getValue() === 'true') {
              this.timelineStore?.openCreateTimelineModal()
              this.timelineStore?.newTimeline?.dateFrom.setValue(new Date().toISOString())
            }
          }
        )
      })
    }

    public fetchMeta(namespace: UniverseNamespace.NamespaceId, typeName: string): Promise<IMetaModel> {
      return super.fetchMeta(namespace, typeName).then((metaModel: any) => {
        metaModel.getAttributes().forEach(this.overrideAttributeHiddenParam)
        return metaModel
      })
    }

    private overrideAttributeHiddenParam(attribute: IMetaAbstractAttribute) {
      if (!MetaTypeGuards.isCodeAttribute(attribute) && !MetaTypeGuards.isSimpleAttribute(attribute)) {
        return
      }

      if (attribute.typeCategory === 'linkDataType') {
        return
      }

      const isForceHidden = attribute.getCustomProperty('forceHidden')?.value.getValue() === 'true'

      if (isForceHidden) {
        attribute.hidden.setValue(true)
      }
    }

    public recalculateReadOnly() {
      super.recalculateReadOnly()
      this.applyReadOnlyForArchivedTimelines()
    }

    public loadData(): Promise<AbstractRecord> {
      const etalonId = this.etalonId
      const dataRecordStore = this.dataRecordStore

      dataRecordStore.setLoading(true)

      return this.initPromise
        .then(() => {
          return etalonId === undefined ? this.initDataEntity() : this.fetchData(etalonId)
        })
        .then((dataRecord: AbstractRecord) => {
          dataRecordStore.setDataEntity(dataRecord)

          runInAction(() => {
            this.isDataInitializedInner = true
          })

          return dataRecord
        })
        .finally(() => {
          if (this.oneTimeFlag === undefined) {
            this.recalculateReadOnly()
            this.oneTimeFlag = true
          }

          dataRecordStore.setLoading(false)
        })
    }

    private async applyReadOnlyForArchivedTimelines() {
      const shouldUpdateProp = this.metaRecordStore
        .getMetaEntity()
        .customProperties.find((prop: any) => prop.name.getValue() === SHOULD_UPDATE_CUSTOM_PROPERTY_NAME)

      const shouldUpdatePropIsTrue = shouldUpdateProp?.value.getValue() === 'true'

      if (!shouldUpdatePropIsTrue) {
        return
      }

      const rolesProperty = await getBackendProperty(READONLY_ROLES_BACKEND_PROPERTY_NAME)

      if (!rolesProperty || typeof rolesProperty !== 'string') {
        Dialog.showWarning(
          `Не настроен параметр системы ${READONLY_ROLES_BACKEND_PROPERTY_NAME}! Пожалуйста, обратитесь к администратору системы`,
          'Не настроен параметр системы!'
        )
        return
      }

      const roles = rolesProperty.split(READONLY_ROLES_BACKEND_PROPERTY_DELIMITER)

      const notRestrictedRole = UserManager.getUserRoles().find((role) => roles.includes(role)) === undefined

      if (!notRestrictedRole) {
        return
      }

      const status = this.dataRecordStore.getDataAttribute(STATUS_ATTRIBUTE_CODE_NAME)?.value.getValue()

      if (status !== null) {
        this.setReadOnlyInternal(true)
      }
    }
  }

  function observeAndDisableInputs() {
    const observer = new MutationObserver(() => {
      const containers = document.querySelectorAll('.dateContainer__FrTLot')

      containers.forEach((container) => {
        const inputs = container.querySelectorAll('input')

        inputs.forEach((input) => {
          if (!input.disabled) {
            input.disabled = true
          }
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  observeAndDisableInputs()

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  NamespaceManager.overrideRecordStoreCtor(namespaceId, SomeCustomDataCardStore)
})

export default {
  userExits: [],
}
