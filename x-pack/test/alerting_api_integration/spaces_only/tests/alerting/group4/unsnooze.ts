/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { RULE_SAVED_OBJECT_TYPE } from '@kbn/alerting-plugin/server';
import { Spaces } from '../../../scenarios';
import type { FtrProviderContext } from '../../../../common/ftr_provider_context';
import {
  AlertUtils,
  checkAAD,
  getUrlPrefix,
  getTestRuleData,
  ObjectRemover,
} from '../../../../common/lib';

// eslint-disable-next-line import/no-default-export
export default function createSnoozeRuleTests({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const supertestWithoutAuth = getService('supertestWithoutAuth');
  const NOW = new Date().toISOString();

  describe('unsnooze', function () {
    this.tags('skipFIPS');
    const objectRemover = new ObjectRemover(supertest);

    after(() => objectRemover.removeAll());

    const alertUtils = new AlertUtils({ space: Spaces.space1, supertestWithoutAuth });

    it('should handle unsnooze rule request appropriately', async () => {
      const { body: createdAction } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/actions/connector`)
        .set('kbn-xsrf', 'foo')
        .send({
          name: 'MY action',
          connector_type_id: 'test.noop',
          config: {},
          secrets: {},
        })
        .expect(200);

      const { body: createdAlert } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestRuleData({
            enabled: false,
            actions: [
              {
                id: createdAction.id,
                group: 'default',
                params: {},
              },
            ],
          })
        )
        .expect(200);
      objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

      const { body: snoozeSchedule } = await supertest
        .post(
          `${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${createdAlert.id}/snooze_schedule`
        )
        .set('kbn-xsrf', 'foo')
        .set('content-type', 'application/json')
        .send({
          schedule: {
            custom: {
              duration: '240h',
              start: NOW,
              recurring: {
                occurrences: 1,
              },
            },
          },
        })
        .expect(200);

      const response = await alertUtils.getUnsnoozeRequest(
        createdAlert.id,
        snoozeSchedule.schedule.id
      );

      expect(response.statusCode).to.eql(204);
      expect(response.body).to.eql('');
      const { body: updatedAlert } = await supertestWithoutAuth
        .get(`${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rule/${createdAlert.id}`)
        .set('kbn-xsrf', 'foo')
        .expect(200);
      expect(updatedAlert.is_snoozed_until).to.eql(null);
      expect(updatedAlert.snooze_schedule.length).to.eql(0);
      expect(updatedAlert.mute_all).to.eql(false);
      // Ensure AAD isn't broken
      await checkAAD({
        supertest,
        spaceId: Spaces.space1.id,
        type: RULE_SAVED_OBJECT_TYPE,
        id: createdAlert.id,
      });
    });

    describe('validation', function () {
      this.tags('skipFIPS');
      it('should return 400 for when rule has no snooze schedule', async () => {
        const { body: createdAlert } = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(
            getTestRuleData({
              enabled: false,
              actions: [],
            })
          )
          .expect(200);
        objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

        const response = await alertUtils.getUnsnoozeRequest(createdAlert.id, 'random_id');

        expect(response.statusCode).to.eql(400);
        expect(response.body.message).to.eql('Rule has no snooze schedules.');
      });

      it('should return 404 for when invalid snooze schedule id', async () => {
        const { body: createdAlert } = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(
            getTestRuleData({
              enabled: false,
              actions: [],
            })
          )
          .expect(200);
        objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

        await supertest
          .post(
            `${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${createdAlert.id}/snooze_schedule`
          )
          .set('kbn-xsrf', 'foo')
          .set('content-type', 'application/json')
          .send({
            schedule: {
              custom: {
                duration: '240h',
                start: NOW,
                recurring: {
                  occurrences: 1,
                },
              },
            },
          })
          .expect(200);

        const response = await alertUtils.getUnsnoozeRequest(createdAlert.id, 'random_id');

        expect(response.statusCode).to.eql(404);
        expect(response.body.message).to.eql('Rule has no snooze schedule with id random_id.');
      });
    });
  });
}
