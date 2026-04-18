import React from 'react';
import { Keystatic } from '@keystatic/core/ui';
import keystaticConfig from '../keystatic.config';

const KeystaticRoute: React.FC = () => <Keystatic config={keystaticConfig} />;

export default KeystaticRoute;
