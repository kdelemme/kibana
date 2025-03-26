/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { RULE_SAVED_OBJECT_TYPE } from '@kbn/alerting-plugin/server';
import { Spaces } from '../../../scenarios';
import {
  checkAAD,
  getUrlPrefix,
  getTestRuleData,
  ObjectRemover,
  resetRulesSettings,
} from '../../../../common/lib';
import type { FtrProviderContext } from '../../../../common/ftr_provider_context';

// eslint-disable-next-line import/no-default-export
export default function createUpdateTests({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');

  describe('update', () => {
    const objectRemover = new ObjectRemover(supertest);

    after(() => objectRemover.removeAll());

    describe('handle update alert request appropriately', function () {
      this.tags('skipFIPS');
      it('should handle update alert request appropriately', async () => {
        const { body: createdAlert } = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(getTestRuleData())
          .expect(200);
        objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

        const updatedData = {
          name: 'bcd',
          tags: ['bar'],
          params: {
            foo: true,
            risk_score: 40,
            severity: 'medium',
          },
          schedule: { interval: '12s' },
          actions: [],
          throttle: '1m',
          notify_when: 'onThrottleInterval',
        };
        let response = await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${createdAlert.id}`)
          .set('kbn-xsrf', 'foo')
          .send(updatedData)
          .expect(200);

        expect(response.body).to.eql({
          ...updatedData,
          id: createdAlert.id,
          tags: ['bar'],
          rule_type_id: 'test.noop',
          running: false,
          consumer: 'alertsFixture',
          created_by: null,
          enabled: true,
          updated_by: null,
          api_key_owner: null,
          api_key_created_by_user: null,
          mute_all: false,
          muted_alert_ids: [],
          notify_when: 'onThrottleInterval',
          revision: 1,
          scheduled_task_id: createdAlert.scheduled_task_id,
          created_at: response.body.created_at,
          updated_at: response.body.updated_at,
          execution_status: response.body.execution_status,
          mapped_params: {
            risk_score: 40,
            severity: '40-medium',
          },
          ...(response.body.next_run ? { next_run: response.body.next_run } : {}),
          ...(response.body.last_run ? { last_run: response.body.last_run } : {}),
        });
        expect(Date.parse(response.body.created_at)).to.be.greaterThan(0);
        expect(Date.parse(response.body.updated_at)).to.be.greaterThan(0);
        expect(Date.parse(response.body.updated_at)).to.be.greaterThan(
          Date.parse(response.body.created_at)
        );
        if (response.body.next_run) {
          expect(Date.parse(response.body.next_run)).to.be.greaterThan(0);
        }

        response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rules/_find`)
          .set('kbn-xsrf', 'kibana')
          .send({ filter: `alert.attributes.params.risk_score:40` });

        expect(response.body.data[0].mapped_params).to.eql({
          risk_score: 40,
          severity: '40-medium',
        });

        // Ensure AAD isn't broken
        await checkAAD({
          supertest,
          spaceId: Spaces.space1.id,
          type: RULE_SAVED_OBJECT_TYPE,
          id: createdAlert.id,
        });
      });
    });

    it(`shouldn't update alert from another space`, async () => {
      const { body: createdAlert } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(getTestRuleData())
        .expect(200);
      objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

      await supertest
        .put(`${getUrlPrefix(Spaces.other.id)}/api/alerting/rule/${createdAlert.id}`)
        .set('kbn-xsrf', 'foo')
        .send({
          name: 'bcd',
          tags: ['foo'],
          params: {
            foo: true,
          },
          schedule: { interval: '12s' },
          actions: [],
          throttle: '1m',
          notify_when: 'onThrottleInterval',
        })
        .expect(404, {
          statusCode: 404,
          error: 'Not Found',
          message: `Saved object [alert/${createdAlert.id}] not found`,
        });
    });

    it('should not allow updating default action without group', async () => {
      const { body: createdAlert } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(getTestRuleData())
        .expect(200);

      objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

      const updatedData = {
        name: 'bcd',
        tags: ['bar'],
        params: {
          foo: true,
          risk_score: 40,
          severity: 'medium',
        },
        schedule: { interval: '12s' },
        actions: [
          {
            // group is missing
            id: 'test-id',
            params: {},
          },
        ],
        throttle: '1m',
        notify_when: 'onThrottleInterval',
      };

      const response = await supertest
        .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${createdAlert.id}`)
        .set('kbn-xsrf', 'foo')
        .send(updatedData);

      expect(response.status).to.eql(400);
      expect(response.body).to.eql({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Group is not defined in action test-id',
      });
    });

    it('should return 400 if the timezone of an action is not valid', async () => {
      const { body: createdAlert } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
        .set('kbn-xsrf', 'foo')
        .send(getTestRuleData())
        .expect(200);

      objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

      const updatedData = {
        name: 'bcd',
        tags: ['bar'],
        schedule: { interval: '12s' },
        throttle: '1m',
        params: {},
        actions: [
          {
            id: 'test-id',
            group: 'default',
            params: {},
            alerts_filter: {
              timeframe: {
                days: [1, 2, 3, 4, 5, 6, 7],
                timezone: 'invalid',
                hours: { start: '00:00', end: '01:00' },
              },
            },
          },
        ],
      };

      const response = await supertest
        .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${createdAlert.id}`)
        .set('kbn-xsrf', 'foo')
        .send(updatedData);

      expect(response.status).to.eql(400);
      expect(response.body).to.eql({
        statusCode: 400,
        error: 'Bad Request',
        message:
          '[request body.actions.0.alerts_filter.timeframe.timezone]: string is not a valid timezone: invalid',
      });
    });

    describe('update rule flapping', () => {
      afterEach(async () => {
        await resetRulesSettings(supertest, 'space1');
      });

      it('should allow flapping to be updated', async () => {
        const response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(getTestRuleData());

        expect(response.body.flapping).eql(undefined);
        objectRemover.add(Spaces.space1.id, response.body.id, 'rule', 'alerting');

        const { body: updatedRule } = await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${response.body.id}`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'bcd',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
            flapping: {
              look_back_window: 5,
              status_change_threshold: 5,
            },
          });

        expect(updatedRule.flapping).eql({
          look_back_window: 5,
          status_change_threshold: 5,
        });
      });

      it('should allow flapping to be removed via update', async () => {
        const response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(
            getTestRuleData({
              flapping: {
                look_back_window: 5,
                status_change_threshold: 5,
              },
            })
          );

        expect(response.body.flapping).eql({
          look_back_window: 5,
          status_change_threshold: 5,
        });

        objectRemover.add(Spaces.space1.id, response.body.id, 'rule', 'alerting');

        const { body: updatedRule } = await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${response.body.id}`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'bcd',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
            flapping: null,
          });

        expect(updatedRule.flapping).eql(null);
      });

      it('should throw if flapping is updated when global flapping is off', async () => {
        const response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(getTestRuleData());

        objectRemover.add(Spaces.space1.id, response.body.id, 'rule', 'alerting');

        await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rules/settings/_flapping`)
          .set('kbn-xsrf', 'foo')
          .send({
            enabled: false,
            look_back_window: 5,
            status_change_threshold: 5,
          });

        await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${response.body.id}`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'bcd',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
            flapping: {
              look_back_window: 5,
              status_change_threshold: 5,
            },
          })
          .expect(400);
      });

      it('should allow rule to be updated when global flapping is off if not updating flapping', async () => {
        const response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(
            getTestRuleData({
              flapping: {
                look_back_window: 5,
                status_change_threshold: 5,
              },
            })
          );

        objectRemover.add(Spaces.space1.id, response.body.id, 'rule', 'alerting');

        await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/internal/alerting/rules/settings/_flapping`)
          .set('kbn-xsrf', 'foo')
          .send({
            enabled: false,
            look_back_window: 5,
            status_change_threshold: 5,
          });

        await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${response.body.id}`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'updated name 1',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
          })
          .expect(200);

        await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${response.body.id}`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'updated name 2',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
            flapping: {
              look_back_window: 5,
              status_change_threshold: 5,
            },
          })
          .expect(200);
      });

      it('should throw if flapping is invalid', async () => {
        const response = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(getTestRuleData());

        objectRemover.add(Spaces.space1.id, response.body.id, 'rule', 'alerting');

        await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule/${response.body.id}`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'bcd',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
            flapping: {
              look_back_window: 5,
              status_change_threshold: 10,
            },
          })
          .expect(400);

        await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send({
            name: 'bcd',
            tags: ['foo'],
            params: {
              foo: true,
            },
            schedule: { interval: '12s' },
            actions: [],
            throttle: '1m',
            notify_when: 'onThrottleInterval',
            flapping: {
              look_back_window: -5,
              status_change_threshold: -5,
            },
          })
          .expect(400);
      });
    });

    describe('legacy', function () {
      this.tags('skipFIPS');
      it('should handle update alert request appropriately', async () => {
        const { body: createdAlert } = await supertest
          .post(`${getUrlPrefix(Spaces.space1.id)}/api/alerting/rule`)
          .set('kbn-xsrf', 'foo')
          .send(getTestRuleData())
          .expect(200);
        objectRemover.add(Spaces.space1.id, createdAlert.id, 'rule', 'alerting');

        const updatedData = {
          name: 'bcd',
          tags: ['bar'],
          params: {
            foo: true,
          },
          schedule: { interval: '12s' },
          actions: [],
          throttle: '1m',
          notifyWhen: 'onThrottleInterval',
        };

        const response = await supertest
          .put(`${getUrlPrefix(Spaces.space1.id)}/api/alerts/alert/${createdAlert.id}`)
          .set('kbn-xsrf', 'foo')
          .send(updatedData)
          .expect(200);

        expect(response.body).to.eql({
          ...updatedData,
          id: createdAlert.id,
          tags: ['bar'],
          alertTypeId: 'test.noop',
          consumer: 'alertsFixture',
          createdBy: null,
          enabled: true,
          updatedBy: null,
          apiKeyOwner: null,
          apiKeyCreatedByUser: null,
          muteAll: false,
          mutedInstanceIds: [],
          notifyWhen: 'onThrottleInterval',
          scheduledTaskId: createdAlert.scheduled_task_id,
          createdAt: response.body.createdAt,
          updatedAt: response.body.updatedAt,
          executionStatus: response.body.executionStatus,
          revision: 1,
          running: false,
          ...(response.body.nextRun ? { nextRun: response.body.nextRun } : {}),
          ...(response.body.lastRun ? { lastRun: response.body.lastRun } : {}),
        });
        expect(Date.parse(response.body.createdAt)).to.be.greaterThan(0);
        expect(Date.parse(response.body.updatedAt)).to.be.greaterThan(0);
        expect(Date.parse(response.body.updatedAt)).to.be.greaterThan(
          Date.parse(response.body.createdAt)
        );
        if (response.body.nextRun) {
          expect(Date.parse(response.body.nextRun)).to.be.greaterThan(0);
        }

        // Ensure AAD isn't broken
        await checkAAD({
          supertest,
          spaceId: Spaces.space1.id,
          type: RULE_SAVED_OBJECT_TYPE,
          id: createdAlert.id,
        });
      });
    });
  });
}
