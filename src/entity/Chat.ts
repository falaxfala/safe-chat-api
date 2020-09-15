import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToMany, JoinTable, OneToMany
} from 'typeorm';
import Message from './Message';
import User from './User';

@Entity()
class Chat {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    conversationName: string;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(type=>Message, message=>message.chat)
    messages: Message[];

}

export default Chat;