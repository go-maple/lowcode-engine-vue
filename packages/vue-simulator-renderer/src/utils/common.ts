import IntlMessageFormat from 'intl-messageformat';
import Debug from 'debug';
import { isI18nData, isJSExpression } from '@alilc/lowcode-types';
import { isEmpty } from 'lodash';

const debug = Debug('utils:index');

const EXPRESSION_TYPE = {
  JSEXPRESSION: 'JSExpression',
  JSFUNCTION: 'JSFunction',
  JSSLOT: 'JSSlot',
  JSBLOCK: 'JSBlock',
  I18N: 'i18n',
};

export function inSameDomain() {
  try {
    return (
      window.parent !== window && window.parent.location.host === window.location.host
    );
  } catch (e) {
    return false;
  }
}

/**
 * 用于处理国际化字符串
 * @param key - 语料标识
 * @param values -  字符串模版变量
 * @param locale - 国际化标识，例如 zh-CN、en-US
 * @param messages - 国际化语言包
 */
export function getI18n(
  key: string,
  values = {},
  locale = 'zh-CN',
  messages: Record<string, any> = {}
) {
  if (!messages || !messages[locale] || !messages[locale][key]) {
    return '';
  }
  const formater = new IntlMessageFormat(messages[locale][key], locale);
  return formater.format(values);
}

export function parseI18n(i18nInfo: any, self: any) {
  return parseExpression(
    {
      type: EXPRESSION_TYPE.JSEXPRESSION,
      value: `this.$t('${i18nInfo.key}')`,
    },
    self
  );
}

export function parseExpression(str: any, self: any): any {
  try {
    const contextArr = ['"use strict";', 'var __self = arguments[0];'];
    contextArr.push('return ');
    let tarStr: string;

    tarStr = (str.value || '').trim();

    tarStr = tarStr.replace(/this(\W|$)/g, (_a: any, b: any) => `__self${b}`);
    tarStr = contextArr.join('\n') + tarStr;

    // 默认调用顶层窗口的parseObj, 保障new Function的window对象是顶层的window对象
    if (inSameDomain() && (window.parent as any).__newFunc) {
      return (window.parent as any).__newFunc(tarStr)(self);
    }
    const code = `with($scope || {}) { ${tarStr} }`;
    return new Function('$scope', code)(self);
  } catch (err) {
    debug('parseExpression.error', err, str, self);
    return undefined;
  }
}

export function parseSchema(schema: unknown, self?: any): any {
  if (isJSExpression(schema)) {
    return parseExpression(schema, self);
  } else if (isI18nData(schema)) {
    return parseI18n(schema, self);
  } else if (typeof schema === 'string') {
    return schema.trim();
  } else if (Array.isArray(schema)) {
    return schema.map((item) => parseSchema(item, self));
  } else if (typeof schema === 'function') {
    return schema.bind(self);
  } else if (typeof schema === 'object') {
    if (!schema) return schema;
    const res: any = {};
    Object.entries(schema).forEach(([key, val]: [any, any]) => {
      if (key.startsWith('__')) return;
      res[key] = parseSchema(val, self);
    });
    return res;
  }
  return schema;
}

export function getValue(obj: any, path: string, defaultValue = {}) {
  if (Array.isArray(obj)) {
    return defaultValue;
  }

  if (isEmpty(obj) || typeof obj !== 'object') {
    return defaultValue;
  }

  const res = path.split('.').reduce((pre, cur) => {
    return pre && pre[cur];
  }, obj);
  if (res === undefined) {
    return defaultValue;
  }
  return res;
}

export function keep<T, K, R>(
  object: T,
  keys: K[] = [],
  rest?: R
): Pick<T, K & keyof T> & R {
  const keepedObject: any = {};
  keys.forEach((key) => {
    keepedObject[key] = (object as any)[key];
  });
  return Object.assign(keepedObject, rest);
}
