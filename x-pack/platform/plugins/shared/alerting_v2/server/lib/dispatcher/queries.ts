/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { esql, type ComposerQuery, type EsqlRequest } from '@elastic/esql';
import { uniq } from 'lodash';
import {
  ALERT_ACTIONS_BACKING_INDEX,
  ALERT_ACTIONS_DATA_STREAM,
} from '../../resources/alert_actions';
import {
  ALERT_EVENTS_BACKING_INDEX,
  ALERT_EVENTS_DATA_STREAM,
  type AlertEventType,
} from '../../resources/alert_events';
import type { AlertEpisode, NotificationGroupId } from './types';

export const getDispatchableAlertEventsQuery = (): EsqlRequest => {
  const alertEventType: AlertEventType = 'alert';

  return esql`FROM ${ALERT_EVENTS_DATA_STREAM},${ALERT_ACTIONS_DATA_STREAM} METADATA _index
      | WHERE (_index LIKE ${ALERT_ACTIONS_BACKING_INDEX}) OR (_index LIKE ${ALERT_EVENTS_BACKING_INDEX} and type == ${alertEventType})
      | EVAL 
          rule_id = COALESCE(rule.id, rule_id),
          episode_id = COALESCE(episode.id, episode_id),
          episode_status = episode.status
      | DROP episode.id, rule.id, episode.status
      | INLINE STATS last_fired = max(last_series_event_timestamp) WHERE _index LIKE ${ALERT_ACTIONS_BACKING_INDEX} AND (action_type == "fire" OR action_type == "suppress") BY rule_id, group_hash
      | WHERE (last_fired IS NULL OR last_fired < @timestamp) or (_index LIKE ${ALERT_ACTIONS_BACKING_INDEX})
      | STATS
          last_event_timestamp = MAX(@timestamp) WHERE _index LIKE ${ALERT_EVENTS_BACKING_INDEX}
          BY rule_id, group_hash, episode_id, episode_status
      | WHERE last_event_timestamp IS NOT NULL
      | KEEP last_event_timestamp, rule_id, group_hash, episode_id, episode_status
      | SORT last_event_timestamp asc
      | LIMIT 10000`.toRequest();
};

export const getAlertEpisodeSuppressionsQuery = (alertEpisodes: AlertEpisode[]): ComposerQuery => {
  const minLastEventTimestamp =
    alertEpisodes.reduce<string | undefined>((min, ep) => {
      const parsedTimestamp = new Date(ep.last_event_timestamp);
      if (Number.isNaN(parsedTimestamp.getTime())) {
        return min;
      }

      const normalizedTimestamp = parsedTimestamp.toISOString();
      return min === undefined || normalizedTimestamp < min ? normalizedTimestamp : min;
    }, undefined) ?? new Date(0).toISOString();

  const ruleIds = uniq(alertEpisodes.map((ep) => ep.rule_id)).map((id) => esql.str(id));
  const groupHashes = uniq(alertEpisodes.map((ep) => ep.group_hash)).map((hash) => esql.str(hash));

  let query = esql.from(ALERT_ACTIONS_DATA_STREAM);
  query = query.where`rule_id IN (${ruleIds})`;
  query = query.where`group_hash IN (${groupHashes})`;
  query = query.where`action_type IN ("ack", "unack", "deactivate", "activate", "snooze", "unsnooze")`;
  query = query.where`action_type != "snooze" OR expiry > ${minLastEventTimestamp}::datetime`;
  query = query.pipe`INLINE STATS
          last_snooze_action = LAST(action_type, @timestamp) WHERE action_type IN ("snooze", "unsnooze")
          BY rule_id, group_hash`;
  query = query.pipe`STATS
          last_ack_action = LAST(action_type, @timestamp) WHERE action_type IN ("ack", "unack"),
          last_deactivate_action = LAST(action_type, @timestamp) WHERE action_type IN ("deactivate", "activate"),
          last_snooze_action = MAX(last_snooze_action) BY rule_id, group_hash, episode_id`;
  query = query.pipe`EVAL should_suppress = CASE(
          last_snooze_action == "snooze", true,
          last_ack_action == "ack", true,
          last_deactivate_action == "deactivate", true,
          false
        )`;
  query = query.keep(
    'rule_id',
    'group_hash',
    'episode_id',
    'should_suppress',
    'last_ack_action',
    'last_deactivate_action',
    'last_snooze_action'
  );
  return query;

  // return esql`FROM ${ALERT_ACTIONS_DATA_STREAM}
  //     | WHERE ${whereClause}
  //     | WHERE action_type IN ("ack", "unack", "deactivate", "activate", "snooze", "unsnooze")
  //     | WHERE action_type != "snooze" OR expiry > ${minLastEventTimestamp}::datetime
  //     | INLINE STATS
  //         last_snooze_action = LAST(action_type, @timestamp) WHERE action_type IN ("snooze", "unsnooze")
  //         BY rule_id, group_hash
  //     | STATS
  //         last_ack_action = LAST(action_type, @timestamp) WHERE action_type IN ("ack", "unack"),
  //         last_deactivate_action = LAST(action_type, @timestamp) WHERE action_type IN ("deactivate", "activate"),
  //         last_snooze_action = MAX(last_snooze_action)
  //       BY rule_id, group_hash, episode_id
  //     | EVAL should_suppress = CASE(
  //         last_snooze_action == "snooze", true,
  //         last_ack_action == "ack", true,
  //         last_deactivate_action == "deactivate", true,
  //         false
  //       )
  //     | KEEP rule_id, group_hash, episode_id, should_suppress, last_ack_action, last_deactivate_action, last_snooze_action`;
};

export const getLastNotifiedTimestampsQuery = (
  notificationGroupIds: NotificationGroupId[]
): EsqlRequest => {
  const values = notificationGroupIds.map((id) => esql.str(id));
  const whereClause = esql.exp`action_type == "notified" AND notification_group_id IN (${values})`;

  return esql`FROM ${ALERT_ACTIONS_DATA_STREAM} 
    | WHERE ${whereClause}
    | STATS last_notified = MAX(@timestamp) BY notification_group_id
    | KEEP notification_group_id, last_notified
    `.toRequest();
};
