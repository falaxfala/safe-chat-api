import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToMany, JoinTable
} from 'typeorm';
import User from './User';

@Entity()
class Chat {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToMany(type => User)
    @JoinTable()
    users: User[];

    @CreateDateColumn()
    createdAt: Date;
}

export default Chat;