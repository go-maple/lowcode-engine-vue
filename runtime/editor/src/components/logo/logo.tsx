import { PluginProps } from '@alilc/lowcode-types';
import './logo.scss';

export interface IProps {
  logo?: string;
  href?: string;
}

export const Logo: React.FC<IProps & PluginProps> = (props): React.ReactElement => {
  return (
    <div className="lowcode-plugin-logo">
      <a
        className="logo"
        target="blank"
        href={props.href || 'https://lowcode-engine.cn'}
        style={{ backgroundImage: `url(${props.logo})` }}
      />
    </div>
  );
};
