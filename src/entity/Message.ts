import {
    Entity,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn, Column, OneToOne, JoinColumn, ManyToOne
} from 'typeorm';
import Chat from './Chat';
import User from './User';

@Entity()
class Message {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    messageText: string;

    @Column()
    isVisible: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToOne(type => User)
    @JoinColumn()
    user: User;

    @ManyToOne(type => Chat, chat => chat.messages)
    chat: Chat;

}
export default Message;