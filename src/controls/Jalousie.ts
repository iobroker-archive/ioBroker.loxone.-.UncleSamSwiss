import { CurrentStateValue, OldStateValue } from '../main';
import { Control } from '../structure-file';
import { ControlBase, ControlType } from './control-base';

export class Jalousie extends ControlBase {
    async loadAsync(type: ControlType, uuid: string, control: Control): Promise<void> {
        await this.updateObjectAsync(uuid, {
            type: type,
            common: {
                name: control.name,
                role: 'blind',
            },
            native: { control: control as any },
        });

        await this.loadOtherControlStatesAsync(control.name, uuid, control.states, [
            'up',
            'down',
            'position',
            'shadePosition',
            'safetyActive',
            'autoAllowed',
            'autoActive',
            'locked',
        ]);

        await this.createBooleanControlStateObjectAsync(control.name, uuid, control.states, 'up', 'indicator', {
            write: true,
        });
        await this.createBooleanControlStateObjectAsync(control.name, uuid, control.states, 'down', 'indicator', {
            write: true,
        });
        await this.createPercentageControlStateObjectAsync(
            control.name,
            uuid,
            control.states,
            'position',
            'level.blind',
            {
                write: true,
                // TODO: re-add: smartIgnore: false
            },
        );
        await this.createPercentageControlStateObjectAsync(
            control.name,
            uuid,
            control.states,
            'shadePosition',
            'level',
        );
        await this.createBooleanControlStateObjectAsync(
            control.name,
            uuid,
            control.states,
            'safetyActive',
            'indicator',
        );
        await this.createBooleanControlStateObjectAsync(control.name, uuid, control.states, 'autoAllowed', 'indicator');
        await this.createBooleanControlStateObjectAsync(control.name, uuid, control.states, 'autoActive', 'indicator', {
            write: true,
        });
        await this.createBooleanControlStateObjectAsync(control.name, uuid, control.states, 'locked', 'indicator');
        await this.createSimpleControlStateObjectAsync(
            control.name,
            uuid,
            control.states,
            'infoText',
            'string',
            'text',
        );

        this.addStateChangeListener(uuid + '.up', (oldValue: OldStateValue, newValue: CurrentStateValue) => {
            if (newValue) {
                this.sendCommand(control.uuidAction, 'up');
            } else {
                this.sendCommand(control.uuidAction, 'UpOff');
            }
        });
        this.addStateChangeListener(uuid + '.down', (oldValue: OldStateValue, newValue: CurrentStateValue) => {
            if (newValue) {
                this.sendCommand(control.uuidAction, 'down');
            } else {
                this.sendCommand(control.uuidAction, 'DownOff');
            }
        });
        this.addStateChangeListener(uuid + '.autoActive', (oldValue: OldStateValue, newValue: CurrentStateValue) => {
            if (newValue == oldValue) {
                return;
            } else if (newValue) {
                this.sendCommand(control.uuidAction, 'auto');
            } else {
                this.sendCommand(control.uuidAction, 'NoAuto');
            }
        });

        // for Alexa support:
        if (control.states.position) {
            this.addStateChangeListener(uuid + '.position', (oldValue: OldStateValue, newValue: CurrentStateValue) => {
                oldValue = this.convertStateToInt(oldValue);
                newValue = Math.max(0, Math.min(100, this.convertStateToInt(newValue))); // 0 <= newValue <= 100
                if (oldValue == newValue) {
                    return;
                }

                if (newValue == 100) {
                    this.sendCommand(control.uuidAction, 'FullDown');
                    return;
                }
                if (newValue === 0) {
                    this.sendCommand(control.uuidAction, 'FullUp');
                    return;
                }
                let targetValue: number;
                let isGoingDown: boolean;
                if (oldValue < newValue) {
                    targetValue = (newValue - 5) / 100;
                    this.sendCommand(control.uuidAction, 'down');
                    isGoingDown = true;
                } else {
                    targetValue = (newValue + 5) / 100;
                    this.sendCommand(control.uuidAction, 'up');
                    isGoingDown = false;
                }
                const listenerName = 'auto';
                this.addStateEventHandler(
                    control.states.position,
                    async (value: any) => {
                        if (isGoingDown && value >= targetValue) {
                            this.removeStateEventHandler(control.states.position, listenerName);
                            this.sendCommand(control.uuidAction, 'DownOff');
                        } else if (!isGoingDown && value <= targetValue) {
                            this.removeStateEventHandler(control.states.position, listenerName);
                            this.sendCommand(control.uuidAction, 'UpOff');
                        }
                    },
                    listenerName,
                );
            });
        }

        await this.createButtonCommandStateObjectAsync(control.name, uuid, 'fullUp');
        this.addStateChangeListener(uuid + '.fullUp', () => {
            this.sendCommand(control.uuidAction, 'FullUp');
        });

        await this.createButtonCommandStateObjectAsync(control.name, uuid, 'fullDown');
        this.addStateChangeListener(uuid + '.fullDown', () => {
            this.sendCommand(control.uuidAction, 'FullDown');
        });

        await this.createButtonCommandStateObjectAsync(control.name, uuid, 'shade');
        this.addStateChangeListener(uuid + '.shade', () => {
            this.sendCommand(control.uuidAction, 'shade');
        });
    }
}
