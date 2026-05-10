import React from 'react';
import { Keystatic } from '@keystatic/core/ui';
import keystaticConfig from '../keystatic.config';

const keystaticUiConfig = keystaticConfig as unknown as React.ComponentProps<typeof Keystatic>['config'];

const KeystaticRoute: React.FC = () => <Keystatic config={keystaticUiConfig} />;

export default KeystaticRoute;
