/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiBadge, EuiSkeletonText, EuiTabs, EuiTab } from '@elastic/eui';
import { isEmpty } from 'lodash/fp';
import type { Ref, ReactElement, ComponentType } from 'react';
import React, { lazy, memo, Suspense, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useUiSetting$ } from '@kbn/kibana-react-plugin/public';

import { useIsExperimentalFeatureEnabled } from '../../../../common/hooks/use_experimental_features';
import type { State } from '../../../../common/store';
import { useEsqlAvailability } from '../../../../common/hooks/esql/use_esql_availability';
import type { SessionViewConfig } from '../../../../../common/types';
import type { RowRenderer, TimelineId } from '../../../../../common/types/timeline';
import { TimelineTabs } from '../../../../../common/types/timeline';
import { type TimelineType, TimelineTypeEnum } from '../../../../../common/api/timeline';
import {
  useShallowEqualSelector,
  useDeepEqualSelector,
} from '../../../../common/hooks/use_selector';
import {
  EqlEventsCountBadge,
  TimelineEventsCountBadge,
} from '../../../../common/hooks/use_timeline_events_count';
import { timelineActions } from '../../../store';
import type { CellValueElementProps } from '../cell_rendering';
import {
  getActiveTabSelector,
  getNoteIdsSelector,
  getNotesSelector,
  getPinnedEventSelector,
  getShowTimelineSelector,
  getEventIdToNoteIdsSelector,
} from './selectors';
import * as i18n from './translations';
import { useLicense } from '../../../../common/hooks/use_license';
import { initializeTimelineSettings } from '../../../store/actions';
import { selectTimelineById, selectTimelineESQLSavedSearchId } from '../../../store/selectors';
import { fetchNotesBySavedObjectIds, makeSelectNotesBySavedObjectId } from '../../../../notes';
import { ENABLE_VISUALIZATIONS_IN_FLYOUT_SETTING } from '../../../../../common/constants';
import { useUserPrivileges } from '../../../../common/components/user_privileges';
import { LazyTimelineTabRenderer, TimelineTabFallback } from './lazy_timeline_tab_renderer';

/**
 * A HOC which supplies React.Suspense with a fallback component
 * @param Component A component deferred by `React.lazy`
 * @param fallback A fallback component to render while things load. Default is EuiSekeleton for all tabs
 */
const tabWithSuspense = <P extends {}, R = {}>(
  Component: ComponentType<P>,
  fallback: ReactElement | null = <EuiSkeletonText lines={10} />
) => {
  const Comp = React.forwardRef((props: P, ref: Ref<R>) => (
    <Suspense fallback={fallback}>
      <Component {...props} ref={ref} />
    </Suspense>
  ));

  Comp.displayName = `${Component.displayName ?? 'Tab'}WithSuspense`;
  return Comp;
};

const QueryTab = tabWithSuspense(
  lazy(() => import('./query')),
  <TimelineTabFallback />
);
const EqlTab = tabWithSuspense(
  lazy(() => import('./eql')),
  <TimelineTabFallback />
);
const GraphTab = tabWithSuspense(
  lazy(() => import('./graph')),
  <TimelineTabFallback />
);
const NotesTab = tabWithSuspense(
  lazy(() => import('./notes')),
  <TimelineTabFallback />
);
const PinnedTab = tabWithSuspense(
  lazy(() => import('./pinned')),
  <TimelineTabFallback />
);
const SessionTab = tabWithSuspense(
  lazy(() => import('./session')),
  <TimelineTabFallback />
);
const EsqlTab = tabWithSuspense(
  lazy(() => import('./esql')),
  <TimelineTabFallback />
);

interface BasicTimelineTab {
  renderCellValue: (props: CellValueElementProps) => React.ReactNode;
  rowRenderers: RowRenderer[];
  timelineFullScreen?: boolean;
  timelineId: TimelineId;
  timelineType: TimelineType;
  graphEventId?: string;
  sessionViewConfig?: SessionViewConfig | null;
  timelineDescription: string;
}

type ActiveTimelineTabProps = BasicTimelineTab & {
  activeTimelineTab: TimelineTabs;
  showTimeline: boolean;
};

const ActiveTimelineTab = memo<ActiveTimelineTabProps>(
  ({
    activeTimelineTab,
    renderCellValue,
    rowRenderers,
    timelineId,
    timelineType,
    showTimeline,
  }) => {
    const { isEsqlAdvancedSettingEnabled } = useEsqlAvailability();
    const timelineESQLSavedSearch = useShallowEqualSelector((state) =>
      selectTimelineESQLSavedSearchId(state, timelineId)
    );
    const shouldShowESQLTab = useMemo(
      () => isEsqlAdvancedSettingEnabled || timelineESQLSavedSearch != null,
      [isEsqlAdvancedSettingEnabled, timelineESQLSavedSearch]
    );
    const getTab = useCallback(
      (tab: TimelineTabs) => {
        switch (tab) {
          case TimelineTabs.graph:
            return <GraphTab timelineId={timelineId} />;
          case TimelineTabs.notes:
            return <NotesTab timelineId={timelineId} />;
          case TimelineTabs.session:
            return <SessionTab timelineId={timelineId} />;
          default:
            return null;
        }
      },
      [timelineId]
    );

    const isGraphOrNotesTabs = useMemo(
      () =>
        [TimelineTabs.graph, TimelineTabs.notes, TimelineTabs.session].includes(activeTimelineTab),
      [activeTimelineTab]
    );

    return (
      <>
        <LazyTimelineTabRenderer
          timelineId={timelineId}
          shouldShowTab={TimelineTabs.query === activeTimelineTab}
          dataTestSubj={`timeline-tab-content-${TimelineTabs.query}`}
        >
          <QueryTab
            renderCellValue={renderCellValue}
            rowRenderers={rowRenderers}
            timelineId={timelineId}
          />
        </LazyTimelineTabRenderer>
        {showTimeline && shouldShowESQLTab && activeTimelineTab === TimelineTabs.esql && (
          <LazyTimelineTabRenderer
            timelineId={timelineId}
            shouldShowTab={true}
            dataTestSubj={`timeline-tab-content-${TimelineTabs.esql}`}
          >
            <EsqlTab timelineId={timelineId} />
          </LazyTimelineTabRenderer>
        )}
        <LazyTimelineTabRenderer
          timelineId={timelineId}
          shouldShowTab={TimelineTabs.pinned === activeTimelineTab}
          dataTestSubj={`timeline-tab-content-${TimelineTabs.pinned}`}
        >
          <PinnedTab
            renderCellValue={renderCellValue}
            rowRenderers={rowRenderers}
            timelineId={timelineId}
          />
        </LazyTimelineTabRenderer>
        {timelineType === TimelineTypeEnum.default && (
          <LazyTimelineTabRenderer
            timelineId={timelineId}
            shouldShowTab={TimelineTabs.eql === activeTimelineTab}
            dataTestSubj={`timeline-tab-content-${TimelineTabs.eql}`}
          >
            <EqlTab
              renderCellValue={renderCellValue}
              rowRenderers={rowRenderers}
              timelineId={timelineId}
            />
          </LazyTimelineTabRenderer>
        )}
        <LazyTimelineTabRenderer
          timelineId={timelineId}
          shouldShowTab={isGraphOrNotesTabs}
          isOverflowYScroll={activeTimelineTab === TimelineTabs.session}
          dataTestSubj={`timeline-tab-content-${TimelineTabs.graph}-${TimelineTabs.notes}`}
        >
          {isGraphOrNotesTabs ? getTab(activeTimelineTab) : null}
        </LazyTimelineTabRenderer>
      </>
    );
  }
);

ActiveTimelineTab.displayName = 'ActiveTimelineTab';

const CountBadge = styled(EuiBadge)`
  margin-left: ${({ theme }) => theme.eui.euiSizeS};
`;

const StyledEuiTab = styled(EuiTab)`
  .euiTab__content {
    align-items: center;
    display: flex;
    flex-direction: row;
    white-space: pre;
  }

  :focus {
    text-decoration: none;

    > span > span {
      text-decoration: underline;
    }
  }
`;

const StyledEuiTabs = styled(EuiTabs)`
  padding-inline: ${(props) => props.theme.eui.euiSizeM};
`;

const TabsContentComponent: React.FC<BasicTimelineTab> = ({
  renderCellValue,
  rowRenderers,
  timelineId,
  timelineFullScreen,
  timelineType,
  graphEventId,
  sessionViewConfig,
  timelineDescription,
}) => {
  const dispatch = useDispatch();
  const getActiveTab = useMemo(() => getActiveTabSelector(), []);
  const getShowTimeline = useMemo(() => getShowTimelineSelector(), []);
  const getNumberOfPinnedEvents = useMemo(() => getPinnedEventSelector(), []);
  const getAppNotes = useMemo(() => getNotesSelector(), []);
  const getTimelineNoteIds = useMemo(() => getNoteIdsSelector(), []);
  const getTimelinePinnedEventNotes = useMemo(() => getEventIdToNoteIdsSelector(), []);
  const { isEsqlAdvancedSettingEnabled } = useEsqlAvailability();

  const timelineESQLSavedSearch = useShallowEqualSelector((state) =>
    selectTimelineESQLSavedSearchId(state, timelineId)
  );

  const securitySolutionNotesDisabled = useIsExperimentalFeatureEnabled(
    'securitySolutionNotesDisabled'
  );

  const [visualizationInFlyoutEnabled] = useUiSetting$<boolean>(
    ENABLE_VISUALIZATIONS_IN_FLYOUT_SETTING
  );

  const activeTab = useShallowEqualSelector((state) => getActiveTab(state, timelineId));
  const showTimeline = useShallowEqualSelector((state) => getShowTimeline(state, timelineId));
  const shouldShowESQLTab = useMemo(
    () => isEsqlAdvancedSettingEnabled || timelineESQLSavedSearch != null,
    [isEsqlAdvancedSettingEnabled, timelineESQLSavedSearch]
  );

  const numberOfPinnedEvents = useShallowEqualSelector((state) =>
    getNumberOfPinnedEvents(state, timelineId)
  );
  const globalTimelineNoteIds = useDeepEqualSelector((state) =>
    getTimelineNoteIds(state, timelineId)
  );
  const eventIdToNoteIds = useDeepEqualSelector((state) =>
    getTimelinePinnedEventNotes(state, timelineId)
  );
  const appNotes = useDeepEqualSelector((state) => getAppNotes(state));

  const isEnterprisePlus = useLicense().isEnterprise();

  // old notes system (through timeline)
  const allTimelineNoteIds = useMemo(() => {
    const eventNoteIds = Object.values(eventIdToNoteIds).reduce<string[]>(
      (acc, v) => [...acc, ...v],
      []
    );
    return [...globalTimelineNoteIds, ...eventNoteIds];
  }, [globalTimelineNoteIds, eventIdToNoteIds]);

  const numberOfNotesOldSystem = useMemo(
    () =>
      appNotes.filter((appNote) => allTimelineNoteIds.includes(appNote.id)).length +
      (isEmpty(timelineDescription) ? 0 : 1),
    [appNotes, allTimelineNoteIds, timelineDescription]
  );

  const timeline = useSelector((state: State) => selectTimelineById(state, timelineId));
  const timelineSavedObjectId = useMemo(() => timeline?.savedObjectId ?? '', [timeline]);
  const isTimelineSaved: boolean = useMemo(
    () => timelineSavedObjectId.length > 0,
    [timelineSavedObjectId]
  );

  const {
    notesPrivileges: { read: canSeeNotes },
    timelinePrivileges: { read: canSeePinnedTab },
  } = useUserPrivileges();

  // new note system
  const fetchNotes = useCallback(
    () => dispatch(fetchNotesBySavedObjectIds({ savedObjectIds: [timelineSavedObjectId] })),
    [dispatch, timelineSavedObjectId]
  );
  useEffect(() => {
    if (isTimelineSaved) {
      fetchNotes();
    }
  }, [fetchNotes, isTimelineSaved]);

  const selectNotesBySavedObjectId = useMemo(() => makeSelectNotesBySavedObjectId(), []);

  const notesNewSystem = useSelector((state: State) =>
    selectNotesBySavedObjectId(state, timelineSavedObjectId)
  );
  const numberOfNotesNewSystem = useMemo(
    () => notesNewSystem.length + (isEmpty(timelineDescription) ? 0 : 1),
    [notesNewSystem, timelineDescription]
  );

  const numberOfNotes = useMemo(
    () => (securitySolutionNotesDisabled ? numberOfNotesOldSystem : numberOfNotesNewSystem),
    [numberOfNotesNewSystem, numberOfNotesOldSystem, securitySolutionNotesDisabled]
  );

  const setActiveTab = useCallback(
    (tab: TimelineTabs) => {
      dispatch(timelineActions.setActiveTabTimeline({ id: timelineId, activeTab: tab }));
    },
    [dispatch, timelineId]
  );

  const setQueryAsActiveTab = useCallback(() => {
    setActiveTab(TimelineTabs.query);
  }, [setActiveTab]);

  const setEqlAsActiveTab = useCallback(() => {
    setActiveTab(TimelineTabs.eql);
  }, [setActiveTab]);

  const setGraphAsActiveTab = useCallback(() => {
    setActiveTab(TimelineTabs.graph);
  }, [setActiveTab]);

  const setNotesAsActiveTab = useCallback(() => {
    setActiveTab(TimelineTabs.notes);
  }, [setActiveTab]);

  const setPinnedAsActiveTab = useCallback(() => {
    setActiveTab(TimelineTabs.pinned);
  }, [setActiveTab]);

  const setSessionAsActiveTab = useCallback(() => {
    setActiveTab(TimelineTabs.session);
  }, [setActiveTab]);

  const setEsqlAsActiveTab = useCallback(() => {
    dispatch(
      initializeTimelineSettings({
        id: timelineId,
      })
    );
    setActiveTab(TimelineTabs.esql);
  }, [setActiveTab, dispatch, timelineId]);

  useEffect(() => {
    if (!graphEventId && activeTab === TimelineTabs.graph) {
      setQueryAsActiveTab();
    }
  }, [activeTab, graphEventId, setQueryAsActiveTab]);

  return (
    <>
      {!timelineFullScreen && (
        <StyledEuiTabs className="eui-scrollBar">
          <StyledEuiTab
            data-test-subj={`timelineTabs-${TimelineTabs.query}`}
            onClick={setQueryAsActiveTab}
            isSelected={activeTab === TimelineTabs.query}
            disabled={false}
            key={TimelineTabs.query}
          >
            <span>{i18n.QUERY_TAB}</span>
            {showTimeline && <TimelineEventsCountBadge />}
          </StyledEuiTab>
          {shouldShowESQLTab && (
            <StyledEuiTab
              data-test-subj={`timelineTabs-${TimelineTabs.esql}`}
              onClick={setEsqlAsActiveTab}
              isSelected={activeTab === TimelineTabs.esql}
              disabled={false}
              key={TimelineTabs.esql}
            >
              <span>{i18n.DISCOVER_ESQL_IN_TIMELINE_TAB}</span>
            </StyledEuiTab>
          )}
          {timelineType === TimelineTypeEnum.default && (
            <StyledEuiTab
              data-test-subj={`timelineTabs-${TimelineTabs.eql}`}
              onClick={setEqlAsActiveTab}
              isSelected={activeTab === TimelineTabs.eql}
              disabled={false}
              key={TimelineTabs.eql}
            >
              <span>{i18n.EQL_TAB}</span>
              {showTimeline && <EqlEventsCountBadge />}
            </StyledEuiTab>
          )}
          {!visualizationInFlyoutEnabled && (
            <EuiTab
              data-test-subj={`timelineTabs-${TimelineTabs.graph}`}
              onClick={setGraphAsActiveTab}
              isSelected={activeTab === TimelineTabs.graph}
              disabled={!graphEventId}
              key={TimelineTabs.graph}
            >
              {i18n.ANALYZER_TAB}
            </EuiTab>
          )}
          {isEnterprisePlus && !visualizationInFlyoutEnabled && (
            <EuiTab
              data-test-subj={`timelineTabs-${TimelineTabs.session}`}
              onClick={setSessionAsActiveTab}
              isSelected={activeTab === TimelineTabs.session}
              disabled={sessionViewConfig === null}
              key={TimelineTabs.session}
            >
              {i18n.SESSION_TAB}
            </EuiTab>
          )}
          <StyledEuiTab
            data-test-subj={`timelineTabs-${TimelineTabs.notes}`}
            onClick={setNotesAsActiveTab}
            isSelected={activeTab === TimelineTabs.notes}
            disabled={!canSeeNotes || timelineType === TimelineTypeEnum.template}
            key={TimelineTabs.notes}
          >
            <span>{i18n.NOTES_TAB}</span>
            {showTimeline && numberOfNotes > 0 && timelineType === TimelineTypeEnum.default && (
              <CountBadge>{numberOfNotes}</CountBadge>
            )}
          </StyledEuiTab>
          <StyledEuiTab
            data-test-subj={`timelineTabs-${TimelineTabs.pinned}`}
            onClick={setPinnedAsActiveTab}
            disabled={!canSeePinnedTab || timelineType === TimelineTypeEnum.template}
            isSelected={activeTab === TimelineTabs.pinned}
            key={TimelineTabs.pinned}
          >
            <span>{i18n.PINNED_TAB}</span>
            {showTimeline &&
              numberOfPinnedEvents > 0 &&
              timelineType === TimelineTypeEnum.default && (
                <CountBadge>{numberOfPinnedEvents}</CountBadge>
              )}
          </StyledEuiTab>
        </StyledEuiTabs>
      )}

      <ActiveTimelineTab
        activeTimelineTab={activeTab}
        renderCellValue={renderCellValue}
        rowRenderers={rowRenderers}
        timelineId={timelineId}
        timelineType={timelineType}
        timelineDescription={timelineDescription}
        showTimeline={showTimeline}
      />
    </>
  );
};

export const TabsContent = memo(TabsContentComponent);
